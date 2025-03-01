import { google } from "googleapis";
import fs from "fs";
import { authenticate } from "@google-cloud/local-auth";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const LOCALE = "pl-PL";

const CONSIDERED_DAYS = [1, 2, 3, 4, 5];
const CONSIDERED_RANGE = {
  start: "08:00",
  end: "10:00",
};

const CONSIDERED_TIMELINE = {
  time: CONSIDERED_RANGE,
  days: CONSIDERED_DAYS,
};

const splitTimeRange = (timeline) => {
  const [start, end] = timeline.split(" - ");
  return {
    start,
    end,
  };
};
const capitalizeFirstLetter = (string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

const getDayOfWeekIndex = (dateString) => {
  return new Date(dateString).getDay();
};

const getDayOfWeek = (dayIdx, locale) => {
  const options = { weekday: "long" };
  return capitalizeFirstLetter(
    new Date(0, 0, dayIdx).toLocaleDateString(locale, options)
  );
};

const authGoogle = async (shouldSaveToken = false) => {
  const credentials = {
    installed: {
      client_id:
        "541683296976-q3jedll6d1eebgbupag2va6etou5lgsc.apps.googleusercontent.com",
      project_id: "fine-cycling-443605-u3",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_secret: process.env.GOOGLE_API_SECRET,
      redirect_uris: ["http://localhost"],
    },
  };

  const __dirname = path.resolve();
  const TOKEN_PATH = path.join(__dirname, "token.json");
  let auth;

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    auth = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      credentials.installed.redirect_uris[0]
    );
    auth.setCredentials(JSON.parse(token));
  } else {
    auth = await authenticate({
      keyfilePath: path.join(__dirname, "credentials.json"),
      scopes: ["https://www.googleapis.com/auth/calendar.events.freebusy"],
    });
    const token = auth.credentials;
    if (shouldSaveToken) fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  }

  return auth;
};

const getBusySchedule = async (auth) => {
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      timeZone: "Europe/Warsaw",
      items: [{ id: "primary" }],
    },
  });

  const busyTimes = res.data.calendars.primary.busy;
  return busyTimes;
};

const getFreeSchedule = (busyTimes) => {
  const freeSchedule = [];
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let lastEnd = now;

  busyTimes.forEach((period) => {
    const start = new Date(period.start);
    if (lastEnd < start) {
      freeSchedule.push({ start: lastEnd, end: start });
    }
    lastEnd = new Date(period.end);
  });

  if (lastEnd < oneWeekFromNow) {
    freeSchedule.push({ start: lastEnd, end: oneWeekFromNow });
  }

  const formattedFreeSchedule = freeSchedule.map((period) => {
    const startDate = period.start.toISOString().split("T")[0];
    const startTime = period.start.toTimeString().split(" ")[0].substring(0, 5);
    const endTime = period.end.toTimeString().split(" ")[0].substring(0, 5);
    return `${startDate}: ${startTime} - ${endTime}`;
  });

  return formattedFreeSchedule;
};

const checkDayInRange = (day, range) => {
  return range.includes(day);
};

const checkTimeInRange = (time, range) => {
  const { start: startFree, end: endFree } = splitTimeRange(time);
  const [startFreeDate, endFreeDate] = [
    createTimeFromFormat(startFree),
    createTimeFromFormat(endFree),
  ];
  const { start: startRange, end: endRange } = range;
  const startRangeDate = createTimeFromFormat(startRange);
  const endRangeDate = createTimeFromFormat(endRange);
  const isInRange =
    startFreeDate >= startRangeDate || endFreeDate <= endRangeDate;

  const isBeforeRange = startFreeDate < startRangeDate;
  const isAfterRange = endFreeDate > endRangeDate;

  return {
    isInRange,
    isBeforeRange,
    isAfterRange,
    trimmed: {
      start: isBeforeRange ? startRangeDate : startFreeDate,
      end: isAfterRange ? endRangeDate : endFreeDate,
    },
  };
};

const createTimeFromFormat = (timeString) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes
  );
};

const trimToConsideredRange = (freeTimes, consideredRange) => {
  return freeTimes
    .filter((time) => {
      const [date, range] = time.split(": ");
      const freeTimeDay = getDayOfWeekIndex(date);
      const isDayInRange = checkDayInRange(freeTimeDay, consideredRange.days);
      return isDayInRange;
    })
    .map((time) => {
      const [date, range] = time.split(": ");
      const freeTimeProps = checkTimeInRange(range, consideredRange.time);
      const formatted =
        date +
        ": [" +
        formatDateToHHMM(freeTimeProps.trimmed.start) +
        " - " +
        formatDateToHHMM(freeTimeProps.trimmed.end) +
        "]";

      return formatted;
    });
};

const formatDateToHHMM = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const combineScheduleByDate = (schedule) => {
  return schedule.reduce((acc, time) => {
    const [date, times] = time.split(": ");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(times.replace(/\[|\]/g, ""));
    return acc;
  }, {});
};

const mapScheduleDateToDayOfWeek = (schedule) =>
  Object.entries(schedule).map(([date, times]) => {
    const dayIdx = getDayOfWeekIndex(date);
    const dayOfWeek = getDayOfWeek(dayIdx, LOCALE);
    return { [dayOfWeek]: times };
  });

const printFreeTimeSchedule = (schedule) => {
  for (const day of schedule) {
    const [dayName, times] = Object.entries(day)[0];
    console.log(dayName + ":");
    times.forEach((time) => console.log(time));
  }
};

const getFinalFreeSchedule = async () => {
  const auth = await authGoogle();
  const busyTimes = await getBusySchedule(auth);
  const freeFormattedSchedule = getFreeSchedule(busyTimes);

  const freeScheduleInRange = trimToConsideredRange(
    freeFormattedSchedule,
    CONSIDERED_TIMELINE
  );

  const freeScheduleByDate = combineScheduleByDate(freeScheduleInRange);
  const freeScheduleByDayOfWeek = mapScheduleDateToDayOfWeek(freeScheduleByDate);
  printFreeTimeSchedule(freeScheduleByDayOfWeek);
  return freeScheduleByDayOfWeek;
}

getFinalFreeSchedule().catch(console.error);
