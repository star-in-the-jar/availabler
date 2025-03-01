import { useEffect, useState } from "react";
import "./App.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Range } from "react-range";

const PRIMARY_COLOR = "#39ebaf";
const BACKGROUND_COLOR = "#242424";

function App() {
  const [freeSchedule, setFreeSchedule] = useState([]);
  const [meetingLength, setMeetingLength] = useState(60);
  const [selectedDays, setSelectedDays] = useState([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  const [hoursRange, setHoursRange] = useState([8, 20]);

  const dayToIndex = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const handleHoursRangeChange = (values) => {
    setHoursRange(values);
  };

  const toggleDaySelection = (day) => {
    setSelectedDays((prevSelectedDays) =>
      prevSelectedDays.includes(day)
        ? prevSelectedDays.filter((d) => d !== day)
        : [...prevSelectedDays, day]
    );
  };

  const fetchSchedule = async () => {
    const dayIndexes = selectedDays.map((day) => dayToIndex[day]);
    const response = await fetch(
      `http://localhost:3000/api/free-schedule?days=${dayIndexes.join(
        ","
      )}&hoursRange=${hoursRange.join(",")}&meetingLength=${meetingLength}`
    );
    const schedule = await response.json();
    setFreeSchedule(schedule);
  };

  useEffect(() => {
    fetchSchedule();
  }, [selectedDays, hoursRange, meetingLength]);

  return (
    <>
      <div>
        <h1>My schedule:</h1>
        <div className="day-buttons" style={{ display: "flex", gap: "0.3rem" }}>
          {[
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].map((day) => (
            <button
              key={day}
              onClick={() => toggleDaySelection(day)}
              className={selectedDays.includes(day) ? "selected" : ""}
              style={{
                color: selectedDays.includes(day) ? "#fff" : BACKGROUND_COLOR,
                border: "2px solid #ccc",
                borderColor: selectedDays.includes(day)
                  ? PRIMARY_COLOR
                  : "#f0f0f0",
                padding: "0.5rem 1rem",
                borderRadius: "4px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="select-and-slider-wrapper">
          <div className="range-wrapper">
            <Range
              step={1}
              min={8}
              max={20}
              values={hoursRange}
              onChange={handleHoursRangeChange}
              renderTrack={({ props, children }) => (
                <div
                  {...props}
                  style={{
                    ...props.style,
                    height: "6px",
                    width: "100%",
                    borderRadius: "1rem",
                    backgroundColor: "#ccc",
                    margin: "3rem 0",
                  }}
                >
                  {children}
                </div>
              )}
              renderThumb={({ props, index }) => (
                <div
                  {...props}
                  key={index}
                  style={{
                    ...props.style,
                    height: "2rem",
                    width: "3rem",
                    border: "2px solid #ccc",
                    backgroundColor: BACKGROUND_COLOR,
                    borderColor: PRIMARY_COLOR,
                    borderRadius: "0.4rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {hoursRange[index]}:00
                </div>
              )}
            />
          </div>
          <div className="meeting-length-select" style={{
            width: "5rem",
            height: "2rem",
            border: `2px solid ${PRIMARY_COLOR}`,
            backgroundColor: BACKGROUND_COLOR,
            borderRadius: "4px",
            overflow: "hidden",
            transition: "border-color 0.3s ease"
          }}>
            <select
              id="meeting-length"
              value={meetingLength}
              onChange={(e) => setMeetingLength(Number(e.target.value))}
              style={{
                backgroundColor: BACKGROUND_COLOR,
                color: "#fff",
                border: "none",
                padding: "0.5rem",
                cursor: "pointer",
                outline: "none",
                width: "100%",
                height: "100%",
                borderRadius: "4px",
                transition: "background-color 0.3s ease",
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = PRIMARY_COLOR}
              onMouseLeave={(e) => e.target.style.backgroundColor = BACKGROUND_COLOR}
            >
              <option value={15}>15m</option>
              <option value={30}>30m</option>
              <option value={45}>45m</option>
              <option value={60}>1h</option>
              <option value={90}>1h 30m</option>
              <option value={120}>2h</option>
              <option value={180}>3h</option>
              <option value={240}>4h</option>
              <option value={300}>5h</option>
            </select>
          </div>
        </div>
        <ul className="card">
          {freeSchedule.map((day) => (
            <li key={Object.keys(day)[0]}>
              {Object.entries(day).map(([dayName, times]) => (
                <div key={dayName}>
                  <div className="day-schedule">
                    <h3>{dayName}:</h3>
                    <ul className="hour-schedule">
                      {times.map((time, index) => (
                        <li key={index}>{time}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            const formattedSchedule = freeSchedule
              .map((day) => {
                const [dayName, times] = Object.entries(day)[0];
                return `${dayName}:\n${times.join("\n")}`;
              })
              .join("\n\n");
            navigator.clipboard.writeText(formattedSchedule).then(() => {
              toast.success("Schedule copied to clipboard!");
            });
          }}
        >
          Copy Schedule to Clipboard
        </button>
        <ToastContainer />
      </div>
    </>
  );
}

export default App;
