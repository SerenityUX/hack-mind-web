import Head from "next/head";
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Navigation from '../components/Navigation';


const formatUTCTime = (date) => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
};


// Move these outside the component
const formatTime = (date) => {
  const minutes = date.getUTCMinutes();
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric',
    minute: minutes === 0 ? undefined : '2-digit',
    hour12: true,
    timeZone: 'UTC'
  }).toLowerCase();
};

const isTimeOverlapping = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

const isWithinEventBounds = (startTime, endTime, eventStartTime, eventEndTime) => {
  return startTime >= eventStartTime && endTime <= eventEndTime;
};

const COLORS = [
  "2,147,212",
  "218,128,0",
  "8,164,42",
  "142,8,164",
  "190,58,44",
  "89,89,89"
];

const parseTimeString = (timeStr) => {
  // Remove all spaces and convert to lowercase
  const cleanStr = timeStr.toLowerCase().replace(/\s+/g, '');
  
  // Extract am/pm
  const isPM = cleanStr.includes('pm');
  const isAM = cleanStr.includes('am');
  
  // Remove am/pm and any non-numeric characters except colon
  let timeNumbers = cleanStr
    .replace(/[ap]m/, '')
    .replace(/[^\d:]/g, '');
  
  // Handle different formats
  let hours, minutes;
  
  if (timeNumbers.includes(':')) {
    // Format with minutes (7:15, 7:00, etc)
    [hours, minutes] = timeNumbers.split(':').map(num => parseInt(num));
  } else {
    // Format without minutes (7, 12, etc)
    hours = parseInt(timeNumbers);
    minutes = 0;
  }
  
  // Validate parsed numbers
  if (isNaN(hours) || hours < 0 || hours > 12 || 
      isNaN(minutes) || minutes < 0 || minutes >= 60) {
    throw new Error('Invalid time format');
  }
  
  // Convert to 24 hour format
  if (isPM && hours !== 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
};

// Add this helper at the top with other helpers
const adjustTimeForDay = (timeDate, referenceDate, hours, minutes) => {
  // Create initial UTC date
  let adjustedDate = new Date(Date.UTC(
    timeDate.getUTCFullYear(),
    timeDate.getUTCMonth(),
    timeDate.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));

  // For end times: if the time is earlier than start time, assume next day
  if (referenceDate && adjustedDate < referenceDate) {
    adjustedDate = new Date(Date.UTC(
      timeDate.getUTCFullYear(),
      timeDate.getUTCMonth(),
      timeDate.getUTCDate() + 1,
      hours,
      minutes,
      0,
      0
    ));
  }

  return adjustedDate;
};

// Add this helper function to convert 24h time string to Date
const timeStringToDate = (timeStr, baseDate) => {
  const [hours, minutes] = timeStr.split(':').map(num => parseInt(num));
  return new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));
};

// Add this constant at the top with other constants
const MAX_DURATION = 23.99 * 60 * 60 * 1000; // Just under 24 hours in milliseconds

// Add this helper function at the top level
const getInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// First create the TaskCard component (at the top of the file or in a separate component file)
const TaskCard = ({ 
  task, 
  dayStart, 
  selectedEvent,
  setSelectedTask, 
  setSelectedEvent,  // Add this prop
  selectedTask, 
  columnId, 
  setSelectedTaskColumn, 
  selectedTaskColumn,
  editingTaskTitle,
  setEditingTaskTitle,
  editingTaskDescription, 
  setEditingTaskDescription,
  handleTaskUpdate,
  handleDeleteTask  // Add this prop
}) => {
  // Add local state for immediate updates
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDescription, setLocalDescription] = useState(task.description || '');

  // Update local state when task changes
  useEffect(() => {
    setLocalTitle(task.title);
    setLocalDescription(task.description || '');
  }, [task]);

  // Safely parse dates
  let taskStart, taskEnd;
  try {
    // First check if the dates are already Date objects
    if (task.startTime instanceof Date) {
      taskStart = task.startTime;
    } else {
      // Try parsing the date string
      const startStr = task.startTime.replace(/Z$/, ''); // Remove Z if present
      taskStart = new Date(startStr + 'Z');
    }

    if (task.endTime instanceof Date) {
      taskEnd = task.endTime;
    } else {
      const endStr = task.endTime.replace(/Z$/, '');
      taskEnd = new Date(endStr + 'Z');
    }

    // Validate the dates
    if (isNaN(taskStart.getTime())) {
      console.error('Invalid start time:', task.startTime);
      return null;
    }
    if (isNaN(taskEnd.getTime())) {
      console.error('Invalid end time:', task.endTime);
      return null;
    }

  } catch (error) {
    console.error('Error parsing dates:', error, {
      startTime: task.startTime,
      endTime: task.endTime
    });
    return null;
  }

  // Format times with error handling
  let formattedStartTime, formattedEndTime;
  try {
    formattedStartTime = formatTime(taskStart);
    formattedEndTime = formatTime(taskEnd);
  } catch (error) {
    console.error('Error formatting times:', error, {
      taskStart,
      taskEnd
    });
    return null;
  }

  // Calculate dimensions with validation
  let topOffset, duration, height;
  try {
    if (!(dayStart instanceof Date) || isNaN(dayStart.getTime())) {
      console.error('Invalid dayStart:', dayStart);
      return null;
    }

    topOffset = ((taskStart - dayStart) / (1000 * 60 * 60)) * 76;
    duration = (taskEnd - taskStart) / (1000 * 60 * 60);
    height = duration * 76;

    if (isNaN(topOffset) || isNaN(height)) {
      console.error('Invalid calculations:', {
        topOffset,
        duration,
        height,
        taskStart: taskStart.getTime(),
        taskEnd: taskEnd.getTime(),
        dayStart: dayStart.getTime()
      });
      return null;
    }
  } catch (error) {
    console.error('Error calculating dimensions:', error);
    return null;
  }

  const isShortTask = duration <= 1;
  let isSelected = selectedTask?.id === task.id && selectedTaskColumn === columnId
  const renderProfilePictures = (people, limit) => {
    // Sort people: those with profile pictures come first
    const sortedPeople = [...people].sort((a, b) => {
      if (a.profilePicture && !b.profilePicture) return -1;
      if (!a.profilePicture && b.profilePicture) return 1;
      return 0;
    });

    if (isShortTask) {
      // For short tasks: show up to 3 profiles or 2 profiles + overflow
      if (people.length <= 3) {
        return sortedPeople.map((person, personIndex) => (
          <div 
            key={personIndex}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: person.profilePicture ? "transparent" : "#666",
              backgroundImage: person.profilePicture ? `url(${person.profilePicture})` : "none",
              backgroundSize: "cover",
              backgroundPosition: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#EBEBEB",
              fontSize: "10px",
              fontWeight: 500
            }}
          >
            {!person.profilePicture && getInitials(person.name)}
          </div>
        ));
      } else {
        // Show first 2 profiles + overflow for 4 or more people
        return (
          <>
            {sortedPeople.slice(0, 2).map((person, personIndex) => (
              <div 
                key={personIndex}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: person.profilePicture ? "transparent" : "#666",
                  backgroundImage: person.profilePicture ? `url(${person.profilePicture})` : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#EBEBEB",
                  fontSize: "10px",
                  fontWeight: 500
                }}
              >
                {!person.profilePicture && getInitials(person.name)}
              </div>
            ))}
            <div 
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#666",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#EBEBEB",
                fontSize: "10px",
                fontWeight: 500
              }}
            >
              +{people.length - 2}
            </div>
          </>
        );
      }
    } else {
      // For longer tasks: show up to 4 profiles + overflow
      const remainingCount = people.length - 4;
      let displayCount = Math.min(people.length, 4);
      
      // If there's only one more person beyond the limit, increase display count
      if (remainingCount === 1) {
        displayCount = Math.min(people.length, 5);
      }
      
      const displayPeople = sortedPeople.slice(0, displayCount);
      const overflow = people.length > 5;

      return (
        <>
          {displayPeople.map((person, personIndex) => (
            <div 
              key={personIndex}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: person.profilePicture ? "transparent" : "#666",
                backgroundImage: person.profilePicture ? `url(${person.profilePicture})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#EBEBEB",
                fontSize: "12px",
                fontWeight: 500
              }}
            >
              {!person.profilePicture && getInitials(person.name)}
            </div>
          ))}
          {overflow && (
            <div 
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#666",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#EBEBEB",
                fontSize: "12px",
                fontWeight: 500
              }}
            >
              +{people.length - 5}
            </div>
          )}
        </>
      );
    }
  };

  return (
    <div 
      onClick={() => {
        console.log(task)
        setSelectedTask(task);
        setSelectedTaskColumn(columnId);
        setEditingTaskTitle(task.title);
        setEditingTaskDescription(task.description || '');
        setLocalTitle(task.title);
        setLocalDescription(task.description || '');
        console.log(columnId, selectedTaskColumn, columnId == selectedTaskColumn)
      }}
      style={{
        position: "absolute",
        top: topOffset,
        cursor: "pointer",
        width: 201,
        height: height,
        padding: 8,
        zIndex: (isSelected) ? 103 : 'auto'
      }}>
        {isSelected &&           <div style={{position: "absolute", fontSize: "16", cursor: "auto", left: 228, borderRadius: 8, width: 300, backgroundColor: "#fff"}}>
                                                  <div style={{width: "calc(100% - 24px)", borderRadius: "16px 16px 0px 0px", paddingTop: 8, paddingBottom: 8, justifyContent: "space-between", paddingLeft: 16, paddingRight: 8, alignItems: "center", display: "flex", backgroundColor: "#F6F8FA"}}>
                                                  <p style={{margin: 0, fontSize: 14}}>Edit Task</p>
                                                  <img 
                                                    onClick={() => {
                                                      if (window.confirm('Are you sure you want to delete this task?')) {
                                                        handleDeleteTask(task.id);
                                                      }
                                                    }}
                                                    style={{width: 24, height: 24, cursor: "pointer"}} 
                                                    src="/icons/trash.svg"
                                                  />
                                                  </div> 
                                                  <div style={{display: "flex", gap: 16, padding: 16, flexDirection: "column"}}>
                                                    <input
                                                      value={localTitle}
                                                      onChange={(e) => {
                                                        const newTitle = e.target.value;
                                                        setLocalTitle(newTitle);
                                                        setSelectedTask(prev => ({
                                                          ...prev,
                                                          title: newTitle
                                                        }));
                                                        setEditingTaskTitle(newTitle);
                                                      }}
                                                      onBlur={async () => {
                                                        if (localTitle !== task.title) {
                                                          try {
                                                            await handleTaskUpdate(task.id, { title: localTitle });
                                                          } catch (error) {
                                                            setLocalTitle(task.title);
                                                            setEditingTaskTitle(task.title);
                                                            setSelectedTask(prev => ({
                                                              ...prev,
                                                              title: task.title
                                                            }));
                                                          }
                                                        }
                                                      }}
                                                      style={{
                                                        margin: 0, 
                                                        fontSize: 24, 
                                                        cursor: "text", 
                                                        color: "#000",
                                                        outline: "none",
                                                        padding: "2px 4px",
                                                        borderRadius: "4px",
                                                        border: "1px solid transparent",
                                                        transition: "border-color 0.2s"
                                                      }}
                                                    />
                                                    <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                                      <img src="./icons/clock.svg" style={{width: 24, height: 24}}/>
                                                      <div style={{position: "relative"}}>
                                                        <p 
                                                          onClick={(e) => {
                                                            const timeInput = e.currentTarget.nextElementSibling;
                                                            timeInput.showPicker();
                                                          }}
                                                          style={{
                                                            margin: 0, 
                                                            cursor: "pointer",
                                                            padding: 4, 
                                                            backgroundColor: "#F3F2F8", 
                                                            borderRadius: 4,
                                                            minWidth: 70,
                                                            textAlign: "center",
                                                            fontSize: 16
                                                          }}
                                                        >
                                                          {formattedStartTime}
                                                        </p>
                                                        <input 
                                                          type="time"
                                                          value={`${taskStart.getUTCHours().toString().padStart(2, '0')}:${taskStart.getUTCMinutes().toString().padStart(2, '0')}`}
                                                          onChange={async (e) => {
                                                            const newStartTime = timeStringToDate(e.target.value, taskStart);
                                                            const duration = taskEnd - taskStart;
                                                            const newEndTime = new Date(newStartTime.getTime() + duration);
                                                            
                                                            try {
                                                              await handleTaskUpdate(task.id, { 
                                                                startTime: newStartTime.toISOString(),
                                                                endTime: newEndTime.toISOString()
                                                              });
                                                            } catch (error) {
                                                              console.error('Failed to update task times:', error);
                                                            }
                                                          }}
                                                          style={{
                                                            position: "absolute",
                                                            opacity: 0,
                                                            pointerEvents: "none"
                                                          }}
                                                        />
                                                      </div>
                                                      <p style={{margin: 0, fontSize: 16}}>-</p>
                                                      <div style={{position: "relative"}}>
                                                        <p 
                                                          onClick={(e) => {
                                                            const timeInput = e.currentTarget.nextElementSibling;
                                                            timeInput.showPicker();
                                                          }}
                                                          style={{
                                                            margin: 0, 
                                                            cursor: "pointer",
                                                            padding: 4, 
                                                            backgroundColor: "#F3F2F8", 
                                                            borderRadius: 4,
                                                            minWidth: 70,
                                                            textAlign: "center",
                                                            fontSize: 16
                                                          }}
                                                        >
                                                          {formattedEndTime}
                                                        </p>
                                                        <input 
                                                          type="time"
                                                          value={`${taskEnd.getUTCHours().toString().padStart(2, '0')}:${taskEnd.getUTCMinutes().toString().padStart(2, '0')}`}
                                                          onChange={async (e) => {
                                                            const startTime = taskStart;
                                                            let newEndTime = timeStringToDate(e.target.value, taskEnd);
                                                            
                                                            // If end time is before start time, check if moving to next day would be within max duration
                                                            if (newEndTime < startTime) {
                                                              const nextDayEndTime = new Date(newEndTime.getTime() + 24 * 60 * 60 * 1000);
                                                              const duration = nextDayEndTime - startTime;
                                                              
                                                              if (duration <= MAX_DURATION) {
                                                                newEndTime = nextDayEndTime;
                                                              } else {
                                                                return; // Don't allow the change if it would exceed max duration
                                                              }
                                                            }
                                                            
                                                            try {
                                                              await handleTaskUpdate(task.id, { 
                                                                startTime: startTime.toISOString(),
                                                                endTime: newEndTime.toISOString()
                                                              });
                                                            } catch (error) {
                                                              console.error('Failed to update task times:', error);
                                                            }
                                                          }}
                                                          style={{
                                                            position: "absolute",
                                                            opacity: 0,
                                                            pointerEvents: "none"
                                                          }}
                                                        />
                                                      </div>
                                                    </div>
                                                    <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                                      <p style={{margin: 0, fontSize: 14, color: "#666"}}>Assigned To</p>
                                                      
                                                      {/* List current assignments */}
                                                      <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                                        {task.assignedTo.map((person, index) => (
                                                          <div key={index} style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            padding: "8px",
                                                            backgroundColor: "#F6F8FA",
                                                            borderRadius: "8px",
                                                            gap: "8px"
                                                          }}>
                                                            <div style={{
                                                              width: 32,
                                                              height: 32,
                                                              borderRadius: 16,
                                                              backgroundColor: person.profilePicture ? "transparent" : "#666",
                                                              backgroundImage: person.profilePicture ? `url(${person.profilePicture})` : "none",
                                                              backgroundSize: "cover",
                                                              backgroundPosition: "center",
                                                              display: "flex",
                                                              alignItems: "center",
                                                              justifyContent: "center",
                                                              color: "#EBEBEB",
                                                              fontSize: "12px",
                                                              fontWeight: 500
                                                            }}>
                                                              {!person.profilePicture && getInitials(person.name)}
                                                            </div>
                                                            <div style={{flex: 1}}>
                                                              <p style={{margin: 0, fontSize: 14}}>{person.name}</p>
                                                              <p style={{margin: 0, fontSize: 12, color: "#666"}}>{person.email}</p>
                                                            </div>
                                                            <img 
  onClick={async (e) => {
    e.stopPropagation();
    if (window.confirm(`Remove ${person.name} from this task?`)) {
      try {
        const response = await fetch('https://serenidad.click/hacktime/unassignEventTask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: localStorage.getItem('token'),
            taskId: task.id,
            userEmailToRemove: person.email
          }),
        });

        console.log(task.id, person.email)
        if (!response.ok) {
          throw new Error('Failed to unassign user');
        }

        const updatedTask = await response.json();
        
        // Update local state
        setSelectedTask(prev => ({
          ...prev,
          assignedTo: updatedTask.assignedTo
        }));

        // Update the event's tasks array
        setSelectedEvent(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => 
            t.id === task.id ? { ...t, assignedTo: updatedTask.assignedTo } : t
          )
        }));
      } catch (error) {
        console.error('Failed to unassign user:', error);
        alert('Failed to unassign user');
      }
    }
  }}
  src="/icons/trash.svg" 
  style={{
    width: 20,
    height: 20,
    cursor: "pointer",
    opacity: 0.5,
    transition: "opacity 0.2s"
  }}
  onMouseOver={e => e.target.style.opacity = 1}
  onMouseOut={e => e.target.style.opacity = 0.5}
/>
                                                          </div>
                                                        ))}
                                                      </div>

                                                      {/* Add new assignment */}
                                                      <div style={{
                                                        padding: "8px",
                                                        border: "1px dashed #666",
                                                        borderRadius: "8px",
                                                        cursor: "pointer",
                                                        transition: "background-color 0.2s"
                                                      }}
                                                      onClick={() => {
                                                        // Show dropdown of available team members
                                                        const availableMembers = selectedEvent.teamMembers.filter(
                                                          member => !task.assignedTo.some(assigned => assigned.email === member.email)
                                                        );

                                                        if (availableMembers.length === 0) {
                                                          alert('All team members are already assigned to this task');
                                                          return;
                                                        }

                                                        // Create and show dropdown
                                                        const dropdown = document.createElement('div');
                                                        dropdown.style.position = 'absolute';
                                                        dropdown.style.backgroundColor = '#fff';
                                                        dropdown.style.border = '1px solid #D0D7DE';
                                                        dropdown.style.borderRadius = '8px';
                                                        dropdown.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                                                        dropdown.style.maxHeight = '200px';
                                                        dropdown.style.overflowY = 'auto';
                                                        dropdown.style.width = '268px';
                                                        dropdown.style.zIndex = '1000';

                                                        availableMembers.forEach(member => {
                                                          const option = document.createElement('div');
                                                          option.style.padding = '8px';
                                                          option.style.display = 'flex';
                                                          option.style.alignItems = 'center';
                                                          option.style.gap = '8px';
                                                          option.style.cursor = 'pointer';
                                                          option.style.transition = 'background-color 0.2s';

                                                          const avatar = document.createElement('div');
                                                          avatar.style.width = '32px';
                                                          avatar.style.height = '32px';
                                                          avatar.style.borderRadius = '16px';
                                                          avatar.style.backgroundColor = member.profilePicture ? 'transparent' : '#666';
                                                          avatar.style.backgroundImage = member.profilePicture ? `url(${member.profilePicture})` : 'none';
                                                          avatar.style.backgroundSize = 'cover';
                                                          avatar.style.backgroundPosition = 'center';
                                                          avatar.style.display = 'flex';
                                                          avatar.style.alignItems = 'center';
                                                          avatar.style.justifyContent = 'center';
                                                          avatar.style.color = '#EBEBEB';
                                                          avatar.style.fontSize = '12px';
                                                          avatar.style.fontWeight = '500';

                                                          if (!member.profilePicture) {
                                                            avatar.textContent = getInitials(member.name);
                                                          }

                                                          const info = document.createElement('div');
                                                          info.innerHTML = `
                                                            <p style="margin: 0; font-size: 14px">${member.name}</p>
                                                            <p style="margin: 0; font-size: 12px; color: #666">${member.email}</p>
                                                          `;

                                                          option.appendChild(avatar);
                                                          option.appendChild(info);

                                                          option.onmouseover = () => {
                                                            option.style.backgroundColor = '#F6F8FA';
                                                          };
                                                          option.onmouseout = () => {
                                                            option.style.backgroundColor = 'transparent';
                                                          };

                                                          option.onclick = async () => {
                                                            try {
                                                              const response = await fetch('https://serenidad.click/hacktime/assignEventTask', {
                                                                method: 'POST',
                                                                headers: {
                                                                  'Content-Type': 'application/json',
                                                                },
                                                                body: JSON.stringify({
                                                                  token: localStorage.getItem('token'),
                                                                  eventId: selectedEvent.id, // Add the eventId
                                                                  taskId: task.id,
                                                                  assigneeEmail: member.email
                                                                }),
                                                              });

                                                              const data = await response.json();
                                                              
                                                              if (!response.ok) {
                                                                throw new Error(data.error || 'Failed to assign user');
                                                              }

                                                              // Update local state with the response data
                                                              setSelectedTask(prev => ({
                                                                ...prev,
                                                                assignedTo: [...prev.assignedTo, member]
                                                              }));

                                                              // Update the event's tasks array
                                                              setSelectedEvent(prev => ({
                                                                ...prev,
                                                                tasks: prev.tasks.map(t => 
                                                                  t.id === task.id 
                                                                    ? { ...t, assignedTo: [...t.assignedTo, member] }
                                                                    : t
                                                                )
                                                              }));

                                                              dropdown.remove();
                                                            } catch (error) {
                                                              console.error('Failed to assign user:', error);
                                                              alert(error.message);
                                                            }
                                                          };

                                                          dropdown.appendChild(option);
                                                        });

                                                        // Position dropdown below the "Add" button
                                                        const rect = event.target.getBoundingClientRect();
                                                        dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
                                                        dropdown.style.left = `${rect.left + window.scrollX}px`;

                                                        // Add click outside handler
                                                        const handleClickOutside = (e) => {
                                                          if (!dropdown.contains(e.target) && e.target !== event.target) {
                                                            dropdown.remove();
                                                            document.removeEventListener('click', handleClickOutside);
                                                          }
                                                        };

                                                        document.addEventListener('click', handleClickOutside);
                                                        document.body.appendChild(dropdown);
                                                      }}
                                                      >
                                                        <div style={{display: "flex", alignItems: "center", gap: 8, justifyContent: "center"}}>
                                                          <img src="/icons/plus.svg" style={{width: 20, height: 20, opacity: 0.5}} />
                                                          <p style={{margin: 0, fontSize: 14, color: "#666"}}>Add team member</p>
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <textarea
                                                      value={localDescription}
                                                      onChange={(e) => {
                                                        const newDescription = e.target.value;
                                                        setLocalDescription(newDescription);
                                                        setSelectedTask(prev => ({
                                                          ...prev,
                                                          description: newDescription
                                                        }));
                                                        setEditingTaskDescription(newDescription);
                                                      }}
                                                      onBlur={async () => {
                                                        if (localDescription !== task.description) {
                                                          try {
                                                            await handleTaskUpdate(task.id, { description: localDescription });
                                                          } catch (error) {
                                                            setLocalDescription(task.description || '');
                                                            setEditingTaskDescription(task.description || '');
                                                            setSelectedTask(prev => ({
                                                              ...prev,
                                                              description: task.description || ''
                                                            }));
                                                          }
                                                        }
                                                      }}
                                                      placeholder="Add a description..."
                                                      style={{
                                                        padding: "8px",
                                                        border: "1px solid #D0D7DE",
                                                        borderRadius: "8px",
                                                        fontWeight: "400",
                                                        minHeight: "80px",
                                                        resize: "vertical"
                                                      }}
                                                    />
                                                  </div>
                                                </div>

       }
      <div style={{
        backgroundColor: "#fff",
        justifyContent: isShortTask ? "center" : "space-between",
        display: "flex",
        flexDirection: "column",
        height: "calc(100% - 48px)",
        borderRadius: 8,
        padding: 12,
        border: "1px solid #000"
      }}>
        {isShortTask ? (
          // Compact layout for short tasks
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "space-between"
            }}>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 2
              }}>
                <p style={{
                  margin: 0,
                  color: "#333333",
                  opacity: 1.0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  cursor: "text"
                }}>
                  {task.title}
                </p>
                
              </div>
              <div style={{
                display: "flex",
                gap: 4,
                flexShrink: 0
              }}>
                {renderProfilePictures(task.assignedTo, 3)}
              </div>
            </div>
          </div>
        ) : (
          // Original layout for longer tasks
          <>
            <p style={{margin: 0, color: "#333333", opacity: 1.0}}>
              {task.title}
            </p>
            <div style={{display: "flex", flexDirection: "column", gap: 8}}>
              <div style={{display: "flex", gap: 4}}>
                {renderProfilePictures(task.assignedTo, 3)}
              </div>

              <p style={{margin: 0, fontSize: 14, opacity: 0.8}}>
                {formattedStartTime} - {formattedEndTime}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const { tab, eventId } = router.query;
  const currentTab = tab || "Run of Show";

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [newEventId, setNewEventId] = useState(null);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskColumn, setSelectedTaskColumn] = useState(null); // Add this new state

  const [animatingColor, setAnimatingColor] = useState(null);

  const [isInvitingNewUser, setIsInvitingNewUser] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    roleDescription: ''
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [invalidEmail, setInvalidEmail] = useState(false);

  const emailInputRef = useRef(null);

  // Add the new state variables here, with the other state declarations
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingTaskDescription, setEditingTaskDescription] = useState('');

  // Add the task update handler
  const handleTaskUpdate = async (taskId, updates) => {
    try {
      const response = await fetch('https://serenidad.click/hacktime/editEventTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: localStorage.getItem('token'),
          taskId,
          ...updates
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const updatedTask = await response.json();

      // Update local state
      setSelectedEvent(prev => ({
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === taskId ? { ...task, ...updatedTask } : task
        )
      }));

      return updatedTask;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  };

  // Add this effect to reset editing state when task selection changes
  useEffect(() => {
    if (selectedTask) {
      setEditingTaskTitle(selectedTask.title);
      setEditingTaskDescription(selectedTask.description || '');
    } else {
      setEditingTaskTitle('');
      setEditingTaskDescription('');
    }
  }, [selectedTask]);

  useEffect(() => {
    if (isInvitingNewUser && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [isInvitingNewUser]);

  useEffect(() => {
    async function authenticate() {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/signup');
        return;
      }

      try {
        const response = await fetch('https://serenidad.click/hacktime/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const userData = await response.json();
        
        const eventIds = Object.keys(userData.events);

        setUser(userData);
        setLoading(false);

        if (!router.query.eventId && eventIds.length > 0) {
          const lastVisited = localStorage.getItem('lastVisited');
          const targetEventId = lastVisited && eventIds.includes(lastVisited) 
            ? lastVisited 
            : eventIds[0];
            
          const urlParams = new URLSearchParams(window.location.search);
          const tabParam = urlParams.get('tab') ? `&tab=${urlParams.get('tab')}` : '&tab=Run of Show';
          await router.push(`/?eventId=${targetEventId}${tabParam}`);
          setSelectedEventId(targetEventId);
          setSelectedEvent(userData.events[targetEventId]);
          localStorage.setItem('lastVisited', targetEventId);
        } else if (router.query.eventId && eventIds.includes(router.query.eventId)) {
          setSelectedEventId(router.query.eventId);
          setSelectedEvent(userData.events[router.query.eventId]);
          localStorage.setItem('lastVisited', router.query.eventId);
        }
      } catch (error) {
        router.push('/signup');
      }
    }

    authenticate();
  }, []);

  useEffect(() => {
    if (user && eventId && user.events[eventId]) {
      setSelectedEventId(eventId);
      setSelectedEvent(user.events[eventId]);
      localStorage.setItem('lastVisited', eventId);
    }
  }, [user, eventId]);

  const handleUserUpdate = (updatedUser, eventId) => {
    setUser(updatedUser);
    if (eventId) {
      setSelectedEventId(eventId);
      setSelectedEvent(updatedUser.events[eventId]);
    }
  };

  const handleInviteChange = async (e) => {
    const { name, value } = e.target;
    setInviteForm(prev => ({ ...prev, [name]: value }));
    setInviteError('');
    setInvalidEmail(false);

    // Check if user exists when email is entered
    if (name === 'email' && value) {
      try {
        const response = await fetch(`https://serenidad.click/hacktime/checkUser/${value}`);
        const data = await response.json();
        
        // Check if user is already a team member
        const isExistingMember = selectedEvent?.teamMembers?.some(
          member => member.email.toLowerCase() === value.toLowerCase()
        );

        if (isExistingMember) {
          setInviteError('This person is already a team member');
          setInvalidEmail(true);
        } else if (data.exists) {
          setInviteForm(prev => ({ ...prev, name: data.name }));
        }
      } catch (error) {
        console.error('Error checking user:', error);
      }
    }
  };

  const handleInviteSubmit = async () => {
    if (!inviteForm.email || !inviteForm.name) {
      setInviteError('Email and name are required');
      return;
    }

    setInviteLoading(true);
    try {
      const response = await fetch('https://serenidad.click/hacktime/inviteToEvent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: localStorage.getItem('token'),
          inviteeEmail: inviteForm.email,
          inviteeName: inviteForm.name,
          roleDescription: inviteForm.roleDescription,
          eventId: selectedEventId
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite user');
      }

      // Update local state with new team member
      setSelectedEvent(prev => ({
        ...prev,
        teamMembers: [...(prev.teamMembers || []), {
          id: data.user.email, // Using email as ID
          name: data.user.name,
          email: data.user.email,
          roleDescription: data.user.roleDescription,
          profilePicture: data.user.profilePicture
        }]
      }));

      // Close the invite modal
      setIsInvitingNewUser(false);
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (
        e.key === 'Escape' && 
        isInvitingNewUser && 
        document.activeElement.tagName !== 'INPUT' && 
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        setIsInvitingNewUser(false);
        setInviteForm({ email: '', name: '', roleDescription: '' }); // Reset form
        setInviteError(''); // Clear any errors
        setInvalidEmail(false); // Reset invalid email state
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isInvitingNewUser]); // Only re-run if isInvitingNewUser changes

  useEffect(() => {
    const handlePlusKey = (e) => {
      if (
        e.key === '+' && 
        document.activeElement.tagName !== 'INPUT' && 
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault(); // Prevent the '+' from being typed
        setIsInvitingNewUser(true);
      }
    };

    document.addEventListener('keydown', handlePlusKey);
    return () => document.removeEventListener('keydown', handlePlusKey);
  }, []); // Empty dependency array since we don't need to re-run this effect

  // Update the handleEventTitleUpdate function
  const handleEventTitleUpdate = async (calendarEventId, newTitle) => {
    try {
      const response = await fetch('https://serenidad.click/hacktime/updateCalendarEvent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: localStorage.getItem('token'),
          calendarEventId: calendarEventId,
          title: newTitle
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update event title');
      }
      
      // Update the local state with the new title
      setSelectedEvent(prev => ({
        ...prev,
        calendar_events: prev.calendar_events.map(evt => 
          evt.id === calendarEventId ? { ...evt, title: newTitle } : evt
        )
      }));

    } catch (error) {
      console.error('Failed to update event title:', error);
      alert('Failed to update event title: ' + error.message);
    }
  };

  // Move handleDeleteCalendarEvent inside the component
  const handleDeleteCalendarEvent = async (calendarEventId) => {
    try {
      const response = await fetch('https://serenidad.click/hacktime/deleteCalendarEvent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: localStorage.getItem('token'),
          calendarEventId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete calendar event');
      }

      // Remove the event from local state
      setSelectedEvent(prev => ({
        ...prev,
        calendar_events: prev.calendar_events.filter(event => event.id !== calendarEventId)
      }));

    } catch (error) {
      console.error('Failed to delete calendar event:', error);
    }
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSelectedCalendarEvent(null);
        setSelectedTask(null)

      } 
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedCalendarEvent]);

  // Update the handleColorUpdate function
  const handleColorUpdate = async (calendarEventId, colorString) => {
    // Immediately update UI
    setAnimatingColor(colorString);
    setSelectedEvent(prev => ({
      ...prev,
      calendar_events: prev.calendar_events.map(evt => 
        evt.id === calendarEventId ? { ...evt, color: colorString } : evt
      )
    }));
    setSelectedCalendarEvent(prev => ({
      ...prev,
      color: colorString
    }));

    try {
      const response = await fetch('https://serenidad.click/hacktime/updateCalendarEvent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: localStorage.getItem('token'),
          calendarEventId,
          color: colorString
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update event color');
      }

    } catch (error) {
      // Revert the changes if the API call fails
      setSelectedEvent(prev => ({
        ...prev,
        calendar_events: prev.calendar_events.map(evt => 
          evt.id === calendarEventId ? { ...evt, color: selectedCalendarEvent.color } : evt
        )
      }));
      setSelectedCalendarEvent(prev => ({
        ...prev,
        color: prev.color
      }));
    } finally {
      setAnimatingColor(null);
    }
  };

  // Update the keyboard navigation effect
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle arrow keys if:
      // 1. Calendar event is selected
      // 2. Not focused on input/textarea
      // 3. Not focused on contentEditable element
      if (!selectedCalendarEvent || 
          document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.getAttribute('contenteditable') === 'true') {
        return;
      }

      const currentColorIndex = COLORS.indexOf(selectedCalendarEvent.color);
      let newIndex;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = currentColorIndex > 0 ? currentColorIndex - 1 : COLORS.length - 1;
        handleColorUpdate(selectedCalendarEvent.id, COLORS[newIndex]);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = currentColorIndex < COLORS.length - 1 ? currentColorIndex + 1 : 0;
        handleColorUpdate(selectedCalendarEvent.id, COLORS[newIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCalendarEvent]);

  // Update the handleTimeUpdate function
  const handleTimeUpdate = async (calendarEventId, newStartTime, newEndTime) => {
    // Validate times are within main event bounds
    const mainEventStart = new Date(selectedEvent.startTime);
    const mainEventEnd = new Date(selectedEvent.endTime);
    
    // Calculate duration
    const duration = newEndTime - newStartTime;
    
    // If duration would exceed max, don't allow it
    if (duration > MAX_DURATION) {
      return false;
    }

    // If end time is before start time and the duration would be reasonable,
    // move end time to next day
    if (newEndTime < newStartTime && (newEndTime.getTime() + 24 * 60 * 60 * 1000 - newStartTime.getTime()) <= MAX_DURATION) {
      newEndTime = new Date(newEndTime.getTime() + 24 * 60 * 60 * 1000);
    }
    
    if (!isWithinEventBounds(newStartTime, newEndTime, mainEventStart, mainEventEnd)) {
      alert('Event must be within the main event time bounds');
      return false;
    }

    // Check for overlaps with other events
    const hasOverlap = selectedEvent?.calendar_events?.some(event => {
      if (event.id === calendarEventId) return false; // Skip current event
      const existingStart = new Date(event.startTime);
      const existingEnd = new Date(event.endTime);
      return isTimeOverlapping(newStartTime, newEndTime, existingStart, existingEnd);
    });

    if (hasOverlap) {
      alert('Cannot overlap with existing events');
      return false;
    }

    try {
      const response = await fetch('https://serenidad.click/hacktime/updateCalendarEvent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: localStorage.getItem('token'),
          calendarEventId,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update event time');
      }

      // Update local state
      setSelectedEvent(prev => ({
        ...prev,
        calendar_events: prev.calendar_events.map(evt => 
          evt.id === calendarEventId 
            ? { ...evt, startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString() } 
            : evt
        )
      }));

      setSelectedCalendarEvent(prev => ({
        ...prev,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString()
      }));

      return true;
    } catch (error) {
      console.error('Failed to update event time:', error);
      return false;
    }
  };

  // Add this function inside the Home component
  const handleDeleteConfirmation = (calendarEventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      handleDeleteCalendarEvent(calendarEventId);
      setSelectedCalendarEvent(null); // Close the modal after deletion
    }
  };

  // Add this effect for the keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedCalendarEvent || 
          document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.getAttribute('contenteditable') === 'true') {
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeleteConfirmation(selectedCalendarEvent.id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCalendarEvent]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedTask || 
          document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.getAttribute('contenteditable') === 'true') {
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (window.confirm('Are you sure you want to delete this task?')) {
          handleDeleteTask(selectedTask.id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTask]);


  // Add this handler in the Home component where other handlers are defined
  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch('https://serenidad.click/hacktime/deleteEventTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: localStorage.getItem('token'),
          taskId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      // Update local state to remove the task
      setSelectedEvent(prev => ({
        ...prev,
        tasks: prev.tasks.filter(task => task.id !== taskId)
      }));

      // Clear selected task if it was the one deleted
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
        setSelectedTaskColumn(null);
      }

    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task');
    }
  };

  if (loading) {
    return <div></div>;
  }

  return (
    <>
      <Head>
        <title>Hack Mind</title>
        <meta name="description" content="Dynamic Run of Show" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={{width: "100%", height: "100vh", display: "flex", flexDirection: "column"}}>
        

        {isInvitingNewUser && (
          <div 
            onClick={(e) => {
              // Only close if clicking the background (not the modal itself)
              if (e.target === e.currentTarget) {
                setIsInvitingNewUser(false);
                setInviteForm({ email: '', name: '', roleDescription: '' }); // Reset form
                setInviteError(''); // Clear any errors
                setInvalidEmail(false); // Reset invalid email state
              }
            }}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              position: "fixed",
              zIndex: 101,
              height: "100vh",
              display: "flex",
              backgroundColor: "rgba(0, 0, 0, 0.5)"
            }}
          >
            <div style={{maxWidth: 500, width: "100%", padding: 32, backgroundColor: "#fff", borderRadius: "8px"}}>
              <p style={{margin: 0, fontWeight: "bold", fontSize: "24px", marginBottom: "16px"}}>Invite to Event</p>
              
              {inviteError && (
                <div style={{
                  color: 'red',
                  marginBottom: '16px',
                  padding: '8px',
                  backgroundColor: '#ffebee',
                  borderRadius: '4px'
                }}>
                  {inviteError}
                </div>
              )}

              <div style={{display: "flex", gap: "16px", marginBottom: "16px"}}>
                <div style={{display: "flex", flexDirection: "column", width: "100%"}}>
                  <label style={{color: "gray", marginBottom: "8px", display: "block"}}>Email</label>
                  <input
                    ref={emailInputRef}
                    name="email"
                    value={inviteForm.email}
                    onChange={handleInviteChange}
                    placeholder="Enter email address"
                    style={{
                      padding: "8px",
                      border: `1px solid ${invalidEmail ? '#ff0000' : '#D0D7DE'}`,
                      borderRadius: "8px",
                      fontWeight: "400",
                      outline: "none",
                      backgroundColor: invalidEmail ? '#fff5f5' : 'white'
                    }}
                  />
                </div>

                
                <div style={{display: "flex", flexDirection: "column", width: "100%"}}>
                  <label style={{color: "gray", marginBottom: "8px", display: "block"}}>Name</label>
                  <input
                    name="name"
                    value={inviteForm.name}
                    onChange={handleInviteChange}
                    placeholder="Enter full name"
                    style={{
                      padding: "8px",
                      border: "1px solid #D0D7DE",
                      borderRadius: "8px",
                      fontWeight: "400"
                    }}
                  />
                </div>
              </div>
              
              <div style={{marginBottom: "16px", display: "flex", flexDirection: "column"}}>
                <label style={{color: "gray", marginBottom: "8px", display: "block"}}>Role (optional)</label>
                <textarea
                  name="roleDescription"
                  value={inviteForm.roleDescription}
                  onChange={handleInviteChange}
                  placeholder="Enter team member's role"
                  style={{
                    padding: "8px",
                    border: "1px solid #D0D7DE",
                    borderRadius: "8px",
                    fontWeight: "400",
                    minHeight: "80px",
                    resize: "vertical"
                  }}
                />
              </div>

              <button 
                onClick={handleInviteSubmit}
                disabled={inviteLoading || !inviteForm.email || !inviteForm.name}
                style={{
                  width: "100%",
                  background: inviteLoading || !inviteForm.email || !inviteForm.name ? '#666' : 'black',
                  color: "white",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: inviteLoading || !inviteForm.email || !inviteForm.name ? 'default' : 'pointer',
                  marginBottom: "16px"
                }}
              >
                {inviteLoading ? "Sending..." : "Send Invitation"}
              </button>

            </div>
          </div>
        )}
        <Navigation 
          user={user} 
          onUserUpdate={handleUserUpdate}
          selectedEventId={selectedEventId}
          onEventSelect={(eventId) => {
            setSelectedEventId(eventId);
            setSelectedEvent(user.events[eventId]);
          }}
        />
        {currentTab == "Run of Show" && 
        <div style={{
          flex: 1,
          display: "flex",
          color: "#59636E",
          position: "relative"
        }}>
          {(() => {
            // Safety check for selectedEvent and valid dates
            if (!selectedEvent?.startTime || !selectedEvent?.endTime) {
              return null;
            }

            // Calculate total hours between start and end time
            const startDate = new Date(selectedEvent.startTime);
            const endDate = new Date(selectedEvent.endTime);
            const hoursDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60));

            // Validate hoursDiff is a positive number
            if (!hoursDiff || hoursDiff < 0 || !Number.isFinite(hoursDiff)) {
              return null;
            }
            
            return (
              <>
                {/* Fixed Event Schedule Column */}
                <div 
                data-column-id="Event Schedule"
                style={{
                  display: "flex", 
                  flexDirection: "column", 
                  flexShrink: 0,
                  position: "sticky",
                  left: 0,
                  backgroundColor: "white",
                  zIndex: 1
                }}>
                  <p style={{
                    margin: 0, 
                    height: 22, 
                    width: 185,
                    borderRight: "1px solid #EBEBEB", 
                    borderBottom: "1px solid #EBEBEB", 
                    paddingLeft: 32, 
                    paddingTop: 6, 
                    paddingBottom: 5
                  }}>Event Schedule</p>
                  <div 
                    style={{
                      position: "relative",
                      userSelect: "none"
                    }}
                    onMouseDown={(e) => {
                      const targetElement = e.currentTarget;
                      const rect = targetElement.getBoundingClientRect();
                      const initialY = e.clientY;
                      let dragStarted = false;
                      let dragTimeout;
                      
                      // Store initial mouse position
                      const initialMousePos = {
                        x: e.clientX,
                        y: e.clientY
                      };

                      const handleMouseMove = (moveEvent) => {
                        // Calculate distance moved
                        const distance = Math.sqrt(
                          Math.pow(moveEvent.clientX - initialMousePos.x, 2) + 
                          Math.pow(moveEvent.clientY - initialMousePos.y, 2)
                        );

                        // Only start drag if we've moved at least 5 pixels
                        if (!dragStarted && distance < 5) {
                          return;
                        }
                      };

                      // Start listening for mouse movement immediately
                      document.addEventListener('mousemove', handleMouseMove);

                      // Set timeout for drag initialization
                      dragTimeout = setTimeout(() => {
                        const startY = initialY - rect.top;
                        const hoursFromStart = Math.floor(startY / 76);
                        const startTime = new Date(selectedEvent.startTime);
                        const dragStartTime = new Date(startTime.getTime() + (hoursFromStart * 60 * 60 * 1000));
                        let dragEndTime = dragStartTime;
                        
                        const formatUTCTime = (date) => {
                          return date.toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'UTC'
                          });
                        };

                        // Create preview element
                        const preview = document.createElement('div');
                        preview.style.position = 'absolute';
                        preview.style.left = '40px';
                        preview.style.width = 'calc(100% - 48px)';
                        preview.style.backgroundColor = 'rgb(2, 147, 212)';
                        preview.style.borderRadius = '8px';
                        preview.style.zIndex = '1';
                        preview.style.opacity = '0.8';
                        targetElement.appendChild(preview);

                        const updatePreview = (start, end) => {
                          const startHours = Math.floor((start - startTime) / (1000 * 60 * 60));
                          const endHours = Math.ceil((end - startTime) / (1000 * 60 * 60));
                          
                          const topPos = startHours * 76;
                          const height = (endHours - startHours) * 76;
                          
                          preview.style.top = `${topPos}px`;
                          preview.style.height = `${height}px`;
                        };

                        updatePreview(dragStartTime, dragEndTime);
                        dragStarted = true;

                        // Replace the initial mousemove handler with the drag handler
                        document.removeEventListener('mousemove', handleMouseMove);
                        
                        const handleDragMove = (moveEvent) => {
                          const endY = moveEvent.clientY - rect.top;
                          const endHoursFromStart = Math.ceil(endY / 76);
                          dragEndTime = new Date(startTime.getTime() + (endHoursFromStart * 60 * 60 * 1000));
                          updatePreview(dragStartTime, dragEndTime);
                        };

                        document.addEventListener('mousemove', handleDragMove);

                        const handleMouseUp = async () => {
                          // Clean up event listeners
                          document.removeEventListener('mousemove', handleDragMove);
                          document.removeEventListener('mouseup', handleMouseUp);

                          // If we haven't actually started dragging, just clean up and return
                          if (!dragStarted) {
                            return;
                          }

                          // Remove preview element
                          if (preview.parentNode) {
                            preview.remove();
                          }

                          const finalStartTime = dragStartTime < dragEndTime ? dragStartTime : dragEndTime;
                          const finalEndTime = dragStartTime < dragEndTime ? dragEndTime : dragStartTime;

                          // Add validation check
                          const mainEventStart = new Date(selectedEvent.startTime);
                          const mainEventEnd = new Date(selectedEvent.endTime);
                          
                          if (!isWithinEventBounds(finalStartTime, finalEndTime, mainEventStart, mainEventEnd)) {
                            preview.remove();
                            console.log('Events must be within the event start and end times');
                            return;
                          }

                          // Check for overlaps with existing events
                          const hasOverlap = selectedEvent?.calendar_events?.some(event => {
                            const existingStart = new Date(event.startTime);
                            const existingEnd = new Date(event.endTime);
                            return isTimeOverlapping(
                              finalStartTime,
                              finalEndTime,
                              existingStart,
                              existingEnd
                            );
                          });

                          if (hasOverlap) {
                            preview.remove();
                            console.log('Cannot create overlapping events');
                            return;
                          }

                          try {
                            const response = await fetch('https://serenidad.click/hacktime/createCalendarEvent', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                token: localStorage.getItem('token'),
                                eventId: selectedEventId,
                                calendarEventId: crypto.randomUUID(),
                                title: '', // Start with empty title
                                startTime: finalStartTime.toISOString(),
                                endTime: finalEndTime.toISOString(),
                                color: '2,147,212'
                              }),
                            });

                            if (!response.ok) {
                              throw new Error('Failed to create calendar event');
                            }

                            const newEvent = await response.json();
                            
                            setNewEventId(newEvent.id);
                            
                            setSelectedEvent(prev => ({
                              ...prev,
                              calendar_events: [...(prev.calendar_events || []), {
                                ...newEvent,
                                startTime: newEvent.start_time,
                                endTime: newEvent.end_time
                              }]
                            }));

                          } catch (error) {
                            console.error('Failed to create calendar event:', error);
                          }
                        };

                        document.addEventListener('mouseup', handleMouseUp);
                      }, 500); // 500ms delay

                      // Handle early mouse up (before drag starts)
                      const handleEarlyMouseUp = () => {
                        clearTimeout(dragTimeout);
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleEarlyMouseUp);
                      };
                      document.addEventListener('mouseup', handleEarlyMouseUp);
                    }}
                  >
                    {/* Map calendar events */}
                    {selectedEvent?.calendar_events
                      ?.filter(event => {
                        const eventStart = new Date(event.startTime);
                        const eventEnd = new Date(event.endTime);
                        const mainEventStart = new Date(selectedEvent.startTime);
                        const mainEventEnd = new Date(selectedEvent.endTime);
                        return isWithinEventBounds(eventStart, eventEnd, mainEventStart, mainEventEnd);
                      })
                      .map((event, index) => {
                        const eventStart = new Date(event.startTime);
                        const eventEnd = new Date(event.endTime);
                        const dayStart = new Date(selectedEvent.startTime);
                        
                        // Format time helper function
                        const formatTime = (date) => {
                          const minutes = date.getUTCMinutes();
                          return date.toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: minutes === 0 ? undefined : '2-digit',
                            hour12: true,
                            timeZone: 'UTC'
                          }).toLowerCase();
                        };
                        
                        const backgroundColor = event.color ? 
                          `rgb(${event.color})` : 
                          "#DA8000";
                        
                        const topOffset = ((eventStart - dayStart) / (1000 * 60 * 60)) * 76;
                        const duration = (eventEnd - eventStart) / (1000 * 60 * 60);
                        const height = (duration * 76) - 48;
                        
                        return (
                          <div key={index} style={{
                            position: "absolute",
                            zIndex: 2,
                            top: topOffset
                          }}>
                            <div style={{marginLeft: 24, marginTop: 0, padding: 8, height: height}}>
                              <div 
                                onClick={() => {
                                  setSelectedCalendarEvent(event);
                                  console.log("Selected Calendar Event:", event);
                                }}
                                style={{
                                  backgroundColor,
                                  borderRadius: 8,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "space-between",
                                  height: "100%",
                                  padding: 16,
                                  width: "140px",
                                  marginLeft: 8,
                                  userSelect: "none",
                                  cursor: "pointer"
                                }}>
                                <p
                                  ref={el => {
                                    // Auto-focus if this is the newly created event
                                    if (el && event.id === newEventId) {
                                      el.focus();
                                      setNewEventId(null); // Clear the newEventId after focusing
                                    }
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  onClick={(e) => {
                                    e.stopPropagation(); // Stop the click from bubbling up
                                  }}
                                  onBlur={(e) => {
                                    const newTitle = e.target.innerText.trim();
                                    if (newTitle === '' && event.title === '') {
                                      // Delete the event if it was never given a title
                                      handleDeleteCalendarEvent(event.id);
                                    } else if (newTitle !== event.title) {
                                      // Update the title if it changed
                                      handleEventTitleUpdate(event.id, newTitle);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.target.blur();
                                    } else if (e.key === 'Escape') {
                                      // If it's a new event with no title, delete it
                                      if (event.title === '' && e.target.innerText.trim() === '') {
                                        handleDeleteCalendarEvent(event.id);
                                      } else {
                                        // Otherwise just blur the input
                                        e.target.blur();
                                      }
                                    }
                                  }}
                                  style={{
                                    margin: 0,
                                    fontSize: 16,
                                    color: "#fff",
                                    outline: 'none',
                                    cursor: "text",
                                    padding: "2px 4px",
                                    borderRadius: "4px",
                                    transition: "background-color 0.2s",
                                    wordWrap: "break-word",
                                    overflowWrap: "break-word",
                                    whiteSpace: "pre-wrap",
                                    minHeight: "24px",
                                    "&:hover": {
                                      backgroundColor: "rgba(255, 255, 255, 0.1)"
                                    }
                                  }}
                                >
                                  {event.title}
                                </p>
                                <p style={{margin: 0, fontSize: 14, color: "#fff", opacity: 0.8}}>
                                  {formatTime(eventStart)} - {formatTime(eventEnd)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

{(selectedCalendarEvent != null || selectedTask != null) && 
  <div
    onClick={(e) => {
      // Don't deselect if clicking on the contentEditable field
      if (e.target.contentEditable === 'true') {
        return;
      }
      // Only deselect if clicking the background
      if (e.target === e.currentTarget) {
        setSelectedCalendarEvent(null);
        setSelectedTask(null)
      }
    }}
    style={{
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      position: "fixed",
      zIndex: 102,
      marginTop: "-132px",
      height: "100vh",
      display: "flex",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    }}
  >
  </div>
}

                    {selectedCalendarEvent && (
                      <div style={{
                        position: "absolute",
                        zIndex: 103,
                        top: ((new Date(selectedCalendarEvent.startTime) - new Date(selectedEvent.startTime)) / (1000 * 60 * 60)) * 76
                      }}>

                        <div style={{marginLeft: 24, position: "relative", marginTop: 0, padding: 8, height: ((new Date(selectedCalendarEvent.endTime) - new Date(selectedCalendarEvent.startTime)) / (1000 * 60 * 60 - 48))}}>
                          
                          <div style={{position: "absolute", cursor: "auto", left: 200, borderRadius: 8, width: 400, backgroundColor: "#fff"}}>
                            <div style={{width: "calc(100% - 24px)", borderRadius: "16px 16px 0px 0px", paddingTop: 8, paddingBottom: 8, justifyContent: "space-between", paddingLeft: 16, paddingRight: 8, alignItems: "center", display: "flex", backgroundColor: "#F6F8FA"}}>
                            <p style={{margin: 0, fontSize: 14}}>Edit Calendar Event</p>
                            <img 
                              onClick={() => handleDeleteConfirmation(selectedCalendarEvent.id)}
                              style={{width: 24, height: 24, cursor: "pointer"}} 
                              src="/icons/trash.svg"
                            />
                            </div> 
                            <div style={{display: "flex", gap: 16, padding: 16, flexDirection: "column"}}>
                              <p 
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newTitle = e.target.innerText.trim();
                                  if (newTitle !== selectedCalendarEvent.title) {
                                    // Update both states immediately for a smoother UI experience
                                    setSelectedCalendarEvent(prev => ({
                                      ...prev,
                                      title: newTitle
                                    }));
                                    setSelectedEvent(prev => ({
                                      ...prev,
                                      calendar_events: prev.calendar_events.map(evt => 
                                        evt.id === selectedCalendarEvent.id ? { ...evt, title: newTitle } : evt
                                      )
                                    }));
                                    handleEventTitleUpdate(selectedCalendarEvent.id, newTitle);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.blur();
                                  }
                                }}
                                style={{
                                  margin: 0, 
                                  fontSize: 24, 
                                  cursor: "text", 
                                  color: "#000",
                                  outline: "none",
                                  padding: "2px 4px",
                                  borderRadius: "4px",
                                  transition: "background-color 0.2s",
                                  "&:hover": {
                                    backgroundColor: "rgba(0, 0, 0, 0.05)"
                                  }
                                }}
                              >
                                {selectedCalendarEvent.title}
                              </p>
                              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                <img src="./icons/clock.svg" style={{width: 24, height: 24}}/>
                                <div style={{position: "relative"}}>
                                  <p 
                                    onClick={(e) => {
                                      const timeInput = e.currentTarget.nextElementSibling;
                                      timeInput.showPicker();
                                    }}
                                    style={{
                                      margin: 0, 
                                      cursor: "pointer",
                                      padding: 4, 
                                      backgroundColor: "#F3F2F8", 
                                      borderRadius: 4,
                                      minWidth: 70,
                                      textAlign: "center",
                                      fontSize: 16
                                    }}
                                  >
                                    {formatTime(new Date(selectedCalendarEvent.startTime))}
                                  </p>
                                  <input 
                                    type="time"
                                    value={`${new Date(selectedCalendarEvent.startTime).getUTCHours().toString().padStart(2, '0')}:${new Date(selectedCalendarEvent.startTime).getUTCMinutes().toString().padStart(2, '0')}`}
                                    onChange={async (e) => {
                                      const newStartTime = timeStringToDate(e.target.value, new Date(selectedCalendarEvent.startTime));
                                      const duration = new Date(selectedCalendarEvent.endTime) - new Date(selectedCalendarEvent.startTime);
                                      const newEndTime = new Date(newStartTime.getTime() + duration);
                                      
                                      await handleTimeUpdate(selectedCalendarEvent.id, newStartTime, newEndTime);
                                    }}
                                    style={{
                                      position: "absolute",
                                      opacity: 0,
                                      pointerEvents: "none"
                                    }}
                                  />
                                </div>
                                <p style={{margin: 0}}>-</p>
                                <div style={{position: "relative"}}>
                                  <p 
                                    onClick={(e) => {
                                      const timeInput = e.currentTarget.nextElementSibling;
                                      timeInput.showPicker();
                                    }}
                                    style={{
                                      margin: 0, 
                                      cursor: "pointer",
                                      padding: 4, 
                                      backgroundColor: "#F3F2F8", 
                                      borderRadius: 4,
                                      minWidth: 70,
                                      textAlign: "center",
                                      fontSize: 16
                                    }}
                                  >
                                    {formatTime(new Date(selectedCalendarEvent.endTime))}
                                  </p>
                                  <input 
                                    type="time"
                                    value={`${new Date(selectedCalendarEvent.endTime).getUTCHours().toString().padStart(2, '0')}:${new Date(selectedCalendarEvent.endTime).getUTCMinutes().toString().padStart(2, '0')}`}
                                    onChange={async (e) => {
                                      const startTime = new Date(selectedCalendarEvent.startTime);
                                      let newEndTime = timeStringToDate(e.target.value, new Date(selectedCalendarEvent.endTime));
                                      
                                      // If end time is before start time, check if moving to next day would be within max duration
                                      if (newEndTime < startTime) {
                                        const nextDayEndTime = new Date(newEndTime.getTime() + 24 * 60 * 60 * 1000);
                                        const duration = nextDayEndTime - startTime;
                                        
                                        if (duration <= MAX_DURATION) {
                                          newEndTime = nextDayEndTime;
                                        } else {
                                          return; // Don't allow the change if it would exceed max duration
                                        }
                                      }
                                      
                                      await handleTimeUpdate(selectedCalendarEvent.id, startTime, newEndTime);
                                    }}
                                    style={{
                                      position: "absolute",
                                      opacity: 0,
                                      pointerEvents: "none"
                                    }}
                                  />
                                </div>
                              </div>
                              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                <img src="./icons/calendar.svg" style={{width: 24, height: 24}}/>
                                <p style={{margin: 0,

fontSize: 16


                                }}>Friday, November 1, 2024</p>
                              </div>
                              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                <img src="./icons/paint.svg" style={{width: 24, height: 24}}/>
                                <p style={{margin: 0}}>Calendar Color</p>
                              </div>
                              <div style={{display: "flex", height: 36, alignItems: "center", flexDirection: "row", gap: 12}}>
                                {COLORS.map((colorString, index) => (
                                  <div 
                                    key={index}
                                    onClick={() => handleColorUpdate(selectedCalendarEvent.id, colorString)}
                                    style={{
                                      backgroundColor: `rgb(${colorString})`,
                                      cursor: "pointer",
                                      borderRadius: "100%",
                                      height: selectedCalendarEvent.color === colorString || animatingColor === colorString ? 36 : 32,
                                      width: selectedCalendarEvent.color === colorString || animatingColor === colorString ? 36 : 32,
                                      opacity: selectedCalendarEvent.color === colorString || animatingColor === colorString ? 1 : 0.5,
                                      transition: "all 0.2s ease"
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div 
                            onClick={(e) => {
                              // Don't deselect if clicking on the contentEditable field
                              if (e.target.contentEditable === 'true') {
                                return;
                              }
                              setSelectedCalendarEvent(null);
                              setSelectedTask(null)

                            }}
                            style={{
                              backgroundColor: selectedCalendarEvent.color ? `rgb(${selectedCalendarEvent.color})` : "#DA8000",
                              borderRadius: 8,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              height: "100%",
                              padding: 16,
                              width: "140px",
                              marginLeft: 8,
                              userSelect: "none",
                              cursor: "pointer"
                            }}>
                            <p
                              contentEditable
                              suppressContentEditableWarning
                              onClick={(e) => {
                                e.stopPropagation(); // Stop the click from bubbling up
                              }}
                              onBlur={(e) => {
                                const newTitle = e.target.innerText.trim();
                                if (newTitle !== selectedCalendarEvent.title) {
                                  handleEventTitleUpdate(selectedCalendarEvent.id, newTitle);
                                }
                              }}
                              style={{
                                margin: 0,
                                fontSize: 16,
                                color: "#fff",
                                outline: 'none',
                                cursor: "text",
                                padding: "2px 4px",
                                borderRadius: "4px",
                                transition: "background-color 0.2s",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                whiteSpace: "pre-wrap",
                                minHeight: "24px"
                              }}
                            >
                              {selectedCalendarEvent.title}
                            </p>
                            <p style={{margin: 0, fontSize: 14, color: "#fff", opacity: 0.8}}>
                              {formatTime(new Date(selectedCalendarEvent.startTime))} - {formatTime(new Date(selectedCalendarEvent.endTime))}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}


                    {Array.from({ length: hoursDiff }).map((_, index) => {
                      const cellTime = new Date(startDate.getTime() + (index * 60 * 60 * 1000));
                      const isFirstCell = index === 0;
                      const previousCellTime = index > 0 
                        ? new Date(startDate.getTime() + ((index - 1) * 60 * 60 * 1000))
                        : null;
                      const dayChanged = previousCellTime && 
                        cellTime.getUTCDate() !== previousCellTime.getUTCDate();

                      // Only show day label if it's first cell or day changed
                      const showDayLabel = isFirstCell || dayChanged;
                      const dayLabel = cellTime.toLocaleString('en-US', { 
                        weekday: 'short', 
                        timeZone: 'UTC'
                      }).toUpperCase();

                      return (
                        <div key={index} style={{
                          width: 217,
                          position: "relative",
                          height: 75,
                          borderRight: "1px solid #EBEBEB",
                          borderBottom: "1px solid #EBEBEB",
                          flexShrink: 0
                        }}>
                          <p style={{
                            position: "absolute",
                            fontSize: 9,
                            paddingLeft: 2,
                            width: 28, 
                            marginTop: -6,
                            backgroundColor: "#fff",
                            userSelect: "none"
                          }}>
                            {showDayLabel && (
                              <span style={{ display: 'block' }}>{dayLabel}</span>
                            )}
                            {cellTime.toLocaleTimeString('en-US', { 
                              hour: 'numeric',
                              timeZone: 'UTC',
                              hour12: true 
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Scrollable section */}
                <div style={{
                  display: "flex",
                  overflowX: "auto",
                }}>
                  {/* You Column */}
                  <div 
                  data-column-id="You"
                  style={{display: "flex", flexDirection: "column", flexShrink: 0}}>
                    <p style={{
                      margin: 0, 
                      height: 22, 
                      width: 201,
                      borderRight: "1px solid #EBEBEB", 
                      borderBottom: "1px solid #EBEBEB", 
                      paddingLeft: 16, 
                      paddingTop: 6, 
                      paddingBottom: 5
                    }}>You</p>
                    
                    {/* Add task mapping for current user */}
                    <div style={{position: "relative"}}>
                      {selectedEvent?.tasks
                        ?.filter(task => task.assignedTo.some(person => person.email === user.email))
                        .map((task, index) => (
                          <TaskCard 
                            key={index}
                            task={task}
                            selectedEvent={selectedEvent}
                            setSelectedEvent={setSelectedEvent}  // Add this prop
                            dayStart={new Date(selectedEvent.startTime)}
                            setSelectedTask={setSelectedTask}
                            selectedTask={selectedTask}
                            columnId={"You"}
                            setSelectedTaskColumn={setSelectedTaskColumn}
                            selectedTaskColumn={selectedTaskColumn}
                            editingTaskTitle={editingTaskTitle}
                            setEditingTaskTitle={setEditingTaskTitle}
                            editingTaskDescription={editingTaskDescription}
                            setEditingTaskDescription={setEditingTaskDescription}
                            handleTaskUpdate={handleTaskUpdate}
                            handleDeleteTask={handleDeleteTask}  // Add this prop
                          />
                        ))}
                    </div>
                    
                    {/* Existing hour grid */}
                    {Array.from({ length: hoursDiff }).map((_, index) => (
                      <div 
                      key={index} 
                      onMouseDown={(e) => {
                        const targetElement = e.currentTarget;
                        const rect = targetElement.getBoundingClientRect();
                        const initialY = e.clientY;
                        let dragStarted = false;
                        let previewElement = null;
                        
                        const columnElement = e.target.closest('[data-column-id]');
                        const columnId = columnElement ? columnElement.dataset.columnId : 'unknown';
                        
                        // Determine the assignee based on column
                        let assigneeEmail;
                        if (columnId === 'You') {
                          assigneeEmail = user.email;
                        } else {
                          const teamMember = selectedEvent?.teamMembers?.find(member => member.name === columnId);
                          assigneeEmail = teamMember?.email;
                        }
                        
                        if (!assigneeEmail) {
                          console.error('No valid assignee found for column:', columnId);
                          return;
                        }
                      
                        const initialMousePos = {
                          x: e.clientX,
                          y: e.clientY
                        };
                      
                        const startY = initialY - rect.top + (index * 76);
                        const hoursFromStart = Math.floor(startY / 76);
                        const startTime = new Date(selectedEvent.startTime);
                        const dragStartTime = new Date(startTime.getTime() + (hoursFromStart * 60 * 60 * 1000));
                        let dragEndTime = dragStartTime;
                      
                        // Create preview element function
                        const createPreviewElement = () => {
                          const preview = document.createElement('div');
                          preview.style.position = 'fixed'; // Changed from 'absolute' to 'fixed'
                          preview.style.width = '215px';
                          preview.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
                          preview.style.border = '2px dashed rgb(37, 99, 235)';
                          preview.style.borderRadius = '6px';
                          preview.style.zIndex = '1000';
                          preview.style.pointerEvents = 'none';
                          
                          // Add time display
                          const timeDisplay = document.createElement('div');
                          timeDisplay.style.padding = '8px';
                          timeDisplay.style.fontSize = '12px';
                          timeDisplay.style.color = 'rgb(37, 99, 235)';
                          timeDisplay.style.fontWeight = 'bold';
                          preview.appendChild(timeDisplay);
                          
                          // Add "New Task" label
                          const label = document.createElement('div');
                          label.textContent = 'New Task';
                          label.style.padding = '8px';
                          label.style.fontSize = '14px';
                          label.style.color = 'rgb(37, 99, 235)';
                          preview.appendChild(label);
                          
                          document.body.appendChild(preview);
                          return preview;
                        };
                      
                        // Update preview element function
                        const updatePreviewElement = (startY, endY) => {
                          if (!previewElement) return;
                          
                          // Get scroll positions
                          const scrollTop = window.scrollY || document.documentElement.scrollTop;
                          const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
                          
                          const top = Math.min(startY, endY) - scrollTop;
                          const height = Math.abs(endY - startY);
                          
                          previewElement.style.top = `${top}px`;
                          previewElement.style.left = `${rect.left - scrollLeft + 1}px`;
                          previewElement.style.height = `${height}px`;
                          
                          // Update time display
                          const timeDisplay = previewElement.firstChild;
                          const startTimeStr = dragStartTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'UTC'
                          });
                          const endTimeStr = dragEndTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'UTC'
                          });
                          timeDisplay.textContent = `${startTimeStr} - ${endTimeStr}`;
                        };
                      
                        const handleMouseMove = (moveEvent) => {
                          const distance = Math.sqrt(
                            Math.pow(moveEvent.clientX - initialMousePos.x, 2) + 
                            Math.pow(moveEvent.clientY - initialMousePos.y, 2)
                          );
                      
                          if (!dragStarted && distance >= 5) {
                            dragStarted = true;
                            previewElement = createPreviewElement();
                          }
                      
                          if (dragStarted) {
                            const endY = moveEvent.clientY - rect.top + (index * 76);
                            const endHoursFromStart = Math.ceil(endY / 76);
                            dragEndTime = new Date(startTime.getTime() + (endHoursFromStart * 60 * 60 * 1000));
                            
                            // Calculate preview position using client coordinates
                            const previewStartY = initialY;
                            const previewEndY = moveEvent.clientY;
                            updatePreviewElement(
                              previewStartY,
                              previewEndY
                            );
                          }
                        };
                      
                        const handleMouseUp = async () => {
                          if (dragStarted) {
                            // Remove preview element
                            if (previewElement) {
                              previewElement.remove();
                            }
                      
                            try {
                              const finalStartTime = dragStartTime < dragEndTime ? dragStartTime : dragEndTime;
                              const finalEndTime = dragStartTime < dragEndTime ? dragEndTime : dragStartTime;
                      
                              const response = await fetch('https://serenidad.click/hacktime/createEventTask', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  token: localStorage.getItem('token'),
                                  eventId: selectedEventId,
                                  title: '',
                                  description: '',
                                  startTime: finalStartTime.toISOString(),
                                  endTime: finalEndTime.toISOString(),
                                  initialAssignee: assigneeEmail
                                }),
                              });
                      
                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to create task');
                              }
                      
                              const newTask = await response.json();
                              setSelectedEvent(prev => ({
                                ...prev,
                                tasks: [...(prev.tasks || []), newTask]
                              }));
                              setSelectedTask(newTask);
                              setSelectedTaskColumn(columnId);
                      
                            } catch (error) {
                              console.error('Failed to create task:', error);
                              alert('Failed to create task: ' + error.message);
                            }
                          }
                          
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                      
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
    style={{
      width: 217,
      height: 75,
      borderRight: "1px solid #EBEBEB",
      borderBottom: "1px solid #EBEBEB",
      flexShrink: 0
    }}
                      ></div>
                    ))}
                  </div>

                  {/* Team Member Columns */}
                  {selectedEvent?.teamMembers?.map((teamMember) => (
                    <div 
                    data-column-id={teamMember.name}

                    key={teamMember.id} style={{display: "flex", flexDirection: "column", flexShrink: 0}}>
                      <p style={{
                        margin: 0, 
                        height: 22, 
                        width: 201,
                        borderRight: "1px solid #EBEBEB",
                        borderBottom: "1px solid #EBEBEB",
                        paddingLeft: 16,
                        paddingTop: 6,
                        paddingBottom: 5
                      }}>{teamMember.name}</p>
                      
                      {/* Add task mapping for team member */}
                      <div style={{position: "relative"}}>
                        {selectedEvent?.tasks
                          ?.filter(task => task.assignedTo.some(person => person.email === teamMember.email))
                          .map((task, index) => (
                            <TaskCard 
                              selectedTask={selectedTask}
                              key={index}
                              selectedEvent={selectedEvent}
                              setSelectedEvent={setSelectedEvent}  // Add this prop
                              task={task}
                              dayStart={new Date(selectedEvent.startTime)}
                              setSelectedTask={setSelectedTask}
                              columnId={teamMember.name}
                              setSelectedTaskColumn={setSelectedTaskColumn}
                              selectedTaskColumn={selectedTaskColumn}
                              editingTaskTitle={editingTaskTitle}
                              setEditingTaskTitle={setEditingTaskTitle}
                              editingTaskDescription={editingTaskDescription}
                              setEditingTaskDescription={setEditingTaskDescription}
                              handleTaskUpdate={handleTaskUpdate}
                              handleDeleteTask={handleDeleteTask}  // Add this prop
                            />
                          ))}
                      </div>
                      
                      {Array.from({ length: hoursDiff }).map((_, index) => (
                        <div 
                        key={index} 
                        onMouseDown={(e) => {
                          const targetElement = e.currentTarget;
                          const rect = targetElement.getBoundingClientRect();
                          const initialY = e.clientY;
                          let dragStarted = false;
                          let previewElement = null;
                          
                          const columnElement = e.target.closest('[data-column-id]');
                          const columnId = columnElement ? columnElement.dataset.columnId : 'unknown';
                          
                          // Determine the assignee based on column
                          let assigneeEmail;
                          if (columnId === 'You') {
                            assigneeEmail = user.email;
                          } else {
                            const teamMember = selectedEvent?.teamMembers?.find(member => member.name === columnId);
                            assigneeEmail = teamMember?.email;
                          }
                          
                          if (!assigneeEmail) {
                            console.error('No valid assignee found for column:', columnId);
                            return;
                          }
                        
                          const initialMousePos = {
                            x: e.clientX,
                            y: e.clientY
                          };
                        
                          const startY = initialY - rect.top + (index * 76);
                          const hoursFromStart = Math.floor(startY / 76);
                          const startTime = new Date(selectedEvent.startTime);
                          const dragStartTime = new Date(startTime.getTime() + (hoursFromStart * 60 * 60 * 1000));
                          let dragEndTime = dragStartTime;
                        
                          // Create preview element function
                          const createPreviewElement = () => {
                            const preview = document.createElement('div');
                            preview.style.position = 'fixed'; // Changed from 'absolute' to 'fixed'
                            preview.style.width = '215px';
                            preview.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
                            preview.style.border = '2px dashed rgb(37, 99, 235)';
                            preview.style.borderRadius = '6px';
                            preview.style.zIndex = '1000';
                            preview.style.pointerEvents = 'none';
                            
                            // Add time display
                            const timeDisplay = document.createElement('div');
                            timeDisplay.style.padding = '8px';
                            timeDisplay.style.fontSize = '12px';
                            timeDisplay.style.color = 'rgb(37, 99, 235)';
                            timeDisplay.style.fontWeight = 'bold';
                            preview.appendChild(timeDisplay);
                            
                            // Add "New Task" label
                            const label = document.createElement('div');
                            label.textContent = 'New Task';
                            label.style.padding = '8px';
                            label.style.fontSize = '14px';
                            label.style.color = 'rgb(37, 99, 235)';
                            preview.appendChild(label);
                            
                            document.body.appendChild(preview);
                            return preview;
                          };
                        
                          // Update preview element function
                          const updatePreviewElement = (startY, endY) => {
                            if (!previewElement) return;
                            
                            // Get scroll positions
                            const scrollTop = window.scrollY || document.documentElement.scrollTop;
                            const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
                            
                            const top = Math.min(startY, endY) - scrollTop;
                            const height = Math.abs(endY - startY);
                            
                            previewElement.style.top = `${top}px`;
                            previewElement.style.left = `${rect.left - scrollLeft + 1}px`;
                            previewElement.style.height = `${height}px`;
                            
                            // Update time display
                            const timeDisplay = previewElement.firstChild;
                            const startTimeStr = dragStartTime.toLocaleTimeString('en-US', { 
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: 'UTC'
                            });
                            const endTimeStr = dragEndTime.toLocaleTimeString('en-US', { 
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: 'UTC'
                            });
                            timeDisplay.textContent = `${startTimeStr} - ${endTimeStr}`;
                          };
                        
                          const handleMouseMove = (moveEvent) => {
                            const distance = Math.sqrt(
                              Math.pow(moveEvent.clientX - initialMousePos.x, 2) + 
                              Math.pow(moveEvent.clientY - initialMousePos.y, 2)
                            );
                        
                            if (!dragStarted && distance >= 5) {
                              dragStarted = true;
                              previewElement = createPreviewElement();
                            }
                        
                            if (dragStarted) {
                              const endY = moveEvent.clientY - rect.top + (index * 76);
                              const endHoursFromStart = Math.ceil(endY / 76);
                              dragEndTime = new Date(startTime.getTime() + (endHoursFromStart * 60 * 60 * 1000));
                              
                              // Calculate preview position using client coordinates
                              const previewStartY = initialY;
                              const previewEndY = moveEvent.clientY;
                              updatePreviewElement(
                                previewStartY,
                                previewEndY
                              );
                            }
                          };
                        
                          const handleMouseUp = async () => {
                            if (dragStarted) {
                              // Remove preview element
                              if (previewElement) {
                                previewElement.remove();
                              }
                        
                              try {
                                const finalStartTime = dragStartTime < dragEndTime ? dragStartTime : dragEndTime;
                                const finalEndTime = dragStartTime < dragEndTime ? dragEndTime : dragStartTime;
                        
                                const response = await fetch('https://serenidad.click/hacktime/createEventTask', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    token: localStorage.getItem('token'),
                                    eventId: selectedEventId,
                                    title: '',
                                    description: '',
                                    startTime: finalStartTime.toISOString(),
                                    endTime: finalEndTime.toISOString(),
                                    initialAssignee: assigneeEmail
                                  }),
                                });
                        
                                if (!response.ok) {
                                  const errorData = await response.json();
                                  throw new Error(errorData.error || 'Failed to create task');
                                }
                        
                                const newTask = await response.json();
                                setSelectedEvent(prev => ({
                                  ...prev,
                                  tasks: [...(prev.tasks || []), newTask]
                                }));
                                setSelectedTask(newTask);
                                setSelectedTaskColumn(columnId);
                        
                              } catch (error) {
                                console.error('Failed to create task:', error);
                                alert('Failed to create task: ' + error.message);
                              }
                            }
                            
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                        
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        style={{
                          width: 217,
                          height: 75,
                          borderRight: "1px solid #EBEBEB",
                          borderBottom: "1px solid #EBEBEB",
                          flexShrink: 0
                        }}
                        ></div>
                      ))}
                    </div>
                  ))}

                  {/* Add Team Column */}
                  <div 
                  onClick={() =>
                    {console.log("Invite new member")
                    setIsInvitingNewUser(true)}
                  }
                  
                  style={{display: "flex", cursor: "pointer", flexDirection: "column", flexShrink: 0}}>
                    <p style={{
                      margin: 0, 
                      height: 22, 
                      width: 201,
                      borderRight: "1px solid #EBEBEB",
                      borderBottom: "1px solid #EBEBEB",
                      paddingLeft: 16,
                      paddingTop: 6,
                      paddingBottom: 5,
                      cursor: "pointer",
                      backgroundColor: "#fff",
                      color: "#0969DA"
                    }}>+ Add</p>
                    {Array.from({ length: hoursDiff }).map((_, index) => (
                      <div key={index} style={{
                        width: 217,
                        height: 75,
                        borderRight: "1px solid #EBEBEB",
                        borderBottom: "1px solid #EBEBEB",
                        flexShrink: 0
                      }}></div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>        
        }

        {currentTab == "Schedule" && 
          <div style={{
            flex: 1,
            display: "flex",
            fontSize: "24px",
            width: "100%",
            justifyContent: "center"
          }}>
            <div style={{
              width: 800, 
              marginTop: 24
            }}>
              <p style={{margin: 0}}>Event Schedule</p>
              
              <div 
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: 24,
                  borderTop: "1px solid #EBEBEB",
                  position: "relative"
                }}
                onMouseDown={(e) => {
                  const targetElement = e.currentTarget;
                  const rect = targetElement.getBoundingClientRect();
                  const initialY = e.clientY;
                  let dragStarted = false;
                  let previewElement = null;
                  
                  const columnElement = e.target.closest('[data-column-id]');
                  const columnId = columnElement ? columnElement.dataset.columnId : 'unknown';
                  
                  // Determine the assignee based on column
                  let assigneeEmail;
                  if (columnId === 'You') {
                    assigneeEmail = user.email;
                  } else {
                    const teamMember = selectedEvent?.teamMembers?.find(member => member.name === columnId);
                    assigneeEmail = teamMember?.email;
                  }
                  
                  if (!assigneeEmail) {
                    console.error('No valid assignee found for column:', columnId);
                    return;
                  }
                
                  const initialMousePos = {
                    x: e.clientX,
                    y: e.clientY
                  };
                
                  const startY = initialY - rect.top + (index * 76);
                  const hoursFromStart = Math.floor(startY / 76);
                  const startTime = new Date(selectedEvent.startTime);
                  const dragStartTime = new Date(startTime.getTime() + (hoursFromStart * 60 * 60 * 1000));
                  let dragEndTime = dragStartTime;
                
                  // Create preview element function
                  const createPreviewElement = () => {
                    const preview = document.createElement('div');
                    preview.style.position = 'fixed'; // Changed from 'absolute' to 'fixed'
                    preview.style.width = '215px'; // Slightly smaller than column width
                    preview.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; // Light blue background
                    preview.style.border = '2px dashed rgb(37, 99, 235)'; // Blue dashed border
                    preview.style.borderRadius = '6px';
                    preview.style.zIndex = '1000';
                    preview.style.pointerEvents = 'none'; // Prevent interference with drag
                    
                    // Add time display
                    const timeDisplay = document.createElement('div');
                    timeDisplay.style.padding = '8px';
                    timeDisplay.style.fontSize = '12px';
                    timeDisplay.style.color = 'rgb(37, 99, 235)';
                    timeDisplay.style.fontWeight = 'bold';
                    preview.appendChild(timeDisplay);
                    
                    // Add "New Task" label
                    const label = document.createElement('div');
                    label.textContent = 'New Task';
                    label.style.padding = '8px';
                    label.style.fontSize = '14px';
                    label.style.color = 'rgb(37, 99, 235)';
                    preview.appendChild(label);
                    
                    document.body.appendChild(preview);
                    return preview;
                  };
                
                  // Update preview element function
                  const updatePreviewElement = (startY, endY) => {
                    if (!previewElement) return;
                    
                    const top = Math.min(startY, endY);
                    const height = Math.abs(endY - startY);
                    
                    previewElement.style.top = `${top}px`;
                    previewElement.style.left = `${rect.left + 1}px`; // +1 for slight offset from border
                    previewElement.style.height = `${height}px`;
                    
                    // Update time display
                    const timeDisplay = previewElement.firstChild;
                    const startTimeStr = dragStartTime.toLocaleTimeString('en-US', { 
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: 'UTC'
                    });
                    const endTimeStr = dragEndTime.toLocaleTimeString('en-US', { 
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: 'UTC'
                    });
                    timeDisplay.textContent = `${startTimeStr} - ${endTimeStr}`;
                  };
                
                  const handleMouseMove = (moveEvent) => {
                    const distance = Math.sqrt(
                      Math.pow(moveEvent.clientX - initialMousePos.x, 2) + 
                      Math.pow(moveEvent.clientY - initialMousePos.y, 2)
                    );
                
                    if (!dragStarted && distance >= 5) {
                      dragStarted = true;
                      previewElement = createPreviewElement();
                    }
                
                    if (dragStarted) {
                      const endY = moveEvent.clientY - rect.top + (index * 76);
                      const endHoursFromStart = Math.ceil(endY / 76);
                      dragEndTime = new Date(startTime.getTime() + (endHoursFromStart * 60 * 60 * 1000));
                      
                      // Calculate preview position using client coordinates
                      const previewStartY = initialY - rect.top + (index * 76);
                      const previewEndY = moveEvent.clientY - rect.top + (index * 76);
                      updatePreviewElement(
                        previewStartY,
                        previewEndY
                      );
                    }
                  };
                
                  const handleMouseUp = async () => {
                    if (dragStarted) {
                      // Remove preview element
                      if (previewElement) {
                        previewElement.remove();
                      }
                
                      try {
                        const finalStartTime = dragStartTime < dragEndTime ? dragStartTime : dragEndTime;
                        const finalEndTime = dragStartTime < dragEndTime ? dragEndTime : dragStartTime;
                
                        const response = await fetch('https://serenidad.click/hacktime/createEventTask', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            token: localStorage.getItem('token'),
                            eventId: selectedEventId,
                            title: '',
                            description: '',
                            startTime: finalStartTime.toISOString(),
                            endTime: finalEndTime.toISOString(),
                            initialAssignee: assigneeEmail
                          }),
                        });
                
                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || 'Failed to create task');
                        }
                
                        const newTask = await response.json();
                        setSelectedEvent(prev => ({
                          ...prev,
                          tasks: [...(prev.tasks || []), newTask]
                        }));
                        setSelectedTask(newTask);
                        setSelectedTaskColumn(columnId);
                
                      } catch (error) {
                        console.error('Failed to create task:', error);
                        alert('Failed to create task: ' + error.message);
                      }
                    }
                    
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                
              >
                
                {selectedCalendarEvent != null && <div
                    onClick={(e) => {
                      // Don't deselect if clicking on the contentEditable field
                      if (e.target.contentEditable === 'true') {
                        return;
                      }
                      // Only deselect if clicking the background
                      if (e.target === e.currentTarget) {
                        setSelectedCalendarEvent(null);
                        setSelectedTask(null)

                      }
                    }}
                style={{
                  width: "100000vw",
                  
                  alignItems: "center",
                  justifyContent: "center",
                  position: "fixed",
                  marginLeft: -10000,
                  zIndex: 102,
                  marginTop: "-132000px",
                  height: "1000000000000vh",
                  display: "flex",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }}
                
                >
                
                </div>}
                {/* Calendar Events Layer */}
                {selectedEvent?.calendar_events
                  ?.filter(event => {
                    const eventStart = new Date(event.startTime);
                    const eventEnd = new Date(event.endTime);
                    const mainEventStart = new Date(selectedEvent.startTime);
                    const mainEventEnd = new Date(selectedEvent.endTime);
                    return isWithinEventBounds(eventStart, eventEnd, mainEventStart, mainEventEnd);
                  })
                  .map((event, index) => {
                    const eventStart = new Date(event.startTime);
                    const eventEnd = new Date(event.endTime);
                    const dayStart = new Date(selectedEvent.startTime);
                    
                    // Format time helper function
                    const formatTime = (date) => {
                      const minutes = date.getUTCMinutes();
                      return date.toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: minutes === 0 ? undefined : '2-digit',
                        hour12: true,
                        timeZone: 'UTC'
                      }).toLowerCase();
                    };
                    
                    const backgroundColor = event.color ? 
                      `rgb(${event.color})` : 
                      "#DA8000";
                    
                    const topOffset = ((eventStart - dayStart) / (1000 * 60 * 60)) * 76;
                    const duration = (eventEnd - eventStart) / (1000 * 60 * 60);
                    const height = (duration * 76) - 48;
                    
                    return (
                      <div key={index} style={{
                        position: "absolute",
            
                        zIndex: selectedCalendarEvent?.id === event.id ? 103 : 2, // Update this line
                        top: topOffset,
                        width: "100%"
                      }}>
                        {selectedCalendarEvent?.id == event.id && 
                          
                                                <div style={{position: "absolute", fontSize: "16", cursor: "auto", left: 800, borderRadius: 8, width: 300, backgroundColor: "#fff"}}>
                                                  <div style={{width: "calc(100% - 24px)", borderRadius: "16px 16px 0px 0px", paddingTop: 8, paddingBottom: 8, justifyContent: "space-between", paddingLeft: 16, paddingRight: 8, alignItems: "center", display: "flex", backgroundColor: "#F6F8FA"}}>
                                                  <p style={{margin: 0, fontSize: 14}}>Edit Calendar Event</p>
                                                  <img 
                                                    onClick={() => handleDeleteConfirmation(selectedCalendarEvent.id)}
                                                    style={{width: 24, height: 24, cursor: "pointer"}} 
                                                    src="/icons/trash.svg"
                                                  />
                                                  </div> 
                                                  <div style={{display: "flex", gap: 16, padding: 16, flexDirection: "column"}}>
                                                    <p 
                                                      contentEditable
                                                      suppressContentEditableWarning
                                                      onBlur={(e) => {
                                                        const newTitle = e.target.innerText.trim();
                                                        if (newTitle !== selectedCalendarEvent.title) {
                                                          // Update both states immediately for a smoother UI experience
                                                          setSelectedCalendarEvent(prev => ({
                                                            ...prev,
                                                            title: newTitle
                                                          }));
                                                          setSelectedEvent(prev => ({
                                                            ...prev,
                                                            calendar_events: prev.calendar_events.map(evt => 
                                                              evt.id === selectedCalendarEvent.id ? { ...evt, title: newTitle } : evt
                                                            )
                                                          }));
                                                          handleEventTitleUpdate(selectedCalendarEvent.id, newTitle);
                                                        }
                                                      }}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          e.preventDefault();
                                                          e.target.blur();
                                                        }
                                                      }}
                                                      style={{
                                                        margin: 0, 
                                                        fontSize: 24, 
                                                        cursor: "text", 
                                                        color: "#000",
                                                        outline: "none",
                                                        padding: "2px 4px",
                                                        borderRadius: "4px",
                                                        transition: "background-color 0.2s",
                                                        "&:hover": {
                                                          backgroundColor: "rgba(0, 0, 0, 0.05)"
                                                        }
                                                      }}
                                                    >
                                                      {selectedCalendarEvent.title}
                                                    </p>
                                                    <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                                      <img src="./icons/clock.svg" style={{width: 24, height: 24}}/>
                                                      <div style={{position: "relative"}}>
                                                        <p 
                                                          onClick={(e) => {
                                                            const timeInput = e.currentTarget.nextElementSibling;
                                                            timeInput.showPicker();
                                                          }}
                                                          style={{
                                                            margin: 0, 
                                                            fontSize: 16,
                                                            cursor: "pointer",
                                                            padding: 4, 
                                                            backgroundColor: "#F3F2F8", 
                                                            borderRadius: 4,
                                                            minWidth: 70,
                                                            textAlign: "center"
                                                          }}
                                                        >
                                                          {formatTime(new Date(selectedCalendarEvent.startTime))}
                                                        </p>
                                                        <input 
                                                          type="time"
                                                          value={`${new Date(selectedCalendarEvent.startTime).getUTCHours().toString().padStart(2, '0')}:${new Date(selectedCalendarEvent.startTime).getUTCMinutes().toString().padStart(2, '0')}`}
                                                          onChange={async (e) => {
                                                            const newStartTime = timeStringToDate(e.target.value, new Date(selectedCalendarEvent.startTime));
                                                            const duration = new Date(selectedCalendarEvent.endTime) - new Date(selectedCalendarEvent.startTime);
                                                            const newEndTime = new Date(newStartTime.getTime() + duration);
                                                            
                                                            await handleTimeUpdate(selectedCalendarEvent.id, newStartTime, newEndTime);
                                                          }}
                                                          style={{
                                                            position: "absolute",
                                                            opacity: 0,
                                                            pointerEvents: "none"
                                                          }}
                                                        />
                                                      </div>
                                                      <p style={{margin: 0, fontSize: 16}}>-</p>
                                                      <div style={{position: "relative"}}>
                                                        <p 
                                                          onClick={(e) => {
                                                            const timeInput = e.currentTarget.nextElementSibling;
                                                            timeInput.showPicker();
                                                          }}
                                                          style={{
                                                            margin: 0, 
                                                            cursor: "pointer",
                                                            padding: 4, 
                                                            backgroundColor: "#F3F2F8", 
                                                            borderRadius: 4,
                                                            minWidth: 70,
                                                            textAlign: "center",
                                                            fontSize: 16
                                                          }}
                                                        >
                                                          {formatTime(new Date(selectedCalendarEvent.endTime))}
                                                        </p>
                                                        <input 
                                                          type="time"
                                                          value={`${new Date(selectedCalendarEvent.endTime).getUTCHours().toString().padStart(2, '0')}:${new Date(selectedCalendarEvent.endTime).getUTCMinutes().toString().padStart(2, '0')}`}
                                                          onChange={async (e) => {
                                                            const startTime = new Date(selectedCalendarEvent.startTime);
                                                            let newEndTime = timeStringToDate(e.target.value, new Date(selectedCalendarEvent.endTime));
                                                            
                                                            // If end time is before start time, check if moving to next day would be within max duration
                                                            if (newEndTime < startTime) {
                                                              const nextDayEndTime = new Date(newEndTime.getTime() + 24 * 60 * 60 * 1000);
                                                              const duration = nextDayEndTime - startTime;
                                                              
                                                              if (duration <= MAX_DURATION) {
                                                                newEndTime = nextDayEndTime;
                                                              } else {
                                                                return; // Don't allow the change if it would exceed max duration
                                                              }
                                                            }
                                                            
                                                            await handleTimeUpdate(selectedCalendarEvent.id, startTime, newEndTime);
                                                          }}
                                                          style={{
                                                            position: "absolute",
                                                            opacity: 0,
                                                            pointerEvents: "none"
                                                          }}
                                                        />
                                                      </div>
                                                    </div>
                                                    <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                                      <img src="./icons/calendar.svg" style={{width: 24, height: 24}}/>
                                                      <p style={{margin: 0, fontSize: 16}}>Friday, November 1, 2024</p>
                                                    </div>
                                                    <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                                      <img src="./icons/paint.svg" style={{width: 24, height: 24}}/>
                                                      <p style={{margin: 0, fontSize: 16}}>Calendar Color</p>
                                                    </div>
                                                    <div style={{display: "flex", height: 36, alignItems: "center", flexDirection: "row", gap: 12}}>
                                                      {COLORS.map((colorString, index) => (
                                                        <div 
                                                          key={index}
                                                          onClick={() => handleColorUpdate(selectedCalendarEvent.id, colorString)}
                                                          style={{
                                                            backgroundColor: `rgb(${colorString})`,
                                                            cursor: "pointer",
                                                            borderRadius: "100%",
                                                            height: selectedCalendarEvent.color === colorString || animatingColor === colorString ? 36 : 32,
                                                            width: selectedCalendarEvent.color === colorString || animatingColor === colorString ? 36 : 32,
                                                            opacity: selectedCalendarEvent.color === colorString || animatingColor === colorString ? 1 : 0.5,
                                                            transition: "all 0.2s ease"
                                                          }}
                                                        />
                                                      ))}
                                                    </div>
                                                  </div>
                                                </div>
                        }
                        <div style={{margin: "0 24px", padding: 8, height: height}}>
                          <div 
                                onClick={() => {
                                  setSelectedCalendarEvent(event);
                                  console.log("Selected Calendar Event:", event);
                                }}                            
                              
                                style={{
                              backgroundColor,
                              borderRadius: 8,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              height: "100%",
                              padding: 16,
                              width: "calc(100% - 16px)",
                              marginLeft: 8,
                              userSelect: "none",
                              cursor: "pointer",
                              ...(duration <= 1 && { justifyContent: "center" }) // Center text if duration is 1 hour or less
                            }}
                          >
                            <p
                              ref={el => {
                                // Auto-focus if this is the newly created event
                                if (el && event.id === newEventId) {
                                  el.focus();
                                  setNewEventId(null); // Clear the newEventId after focusing
                                }
                              }}
                              contentEditable
                              suppressContentEditableWarning
                              onClick={(e) => {
                                e.stopPropagation(); // Stop the click from bubbling up
                              }}
                              onBlur={(e) => {
                                const newTitle = e.target.innerText.trim();
                                if (newTitle === '' && event.title === '') {
                                  // Delete the event if it was never given a title
                                  handleDeleteCalendarEvent(event.id);
                                } else if (newTitle !== event.title) {
                                  // Update the title if it changed
                                  handleEventTitleUpdate(event.id, newTitle);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.target.blur();
                                } else if (e.key === 'Escape') {
                                  // If it's a new event with no title, delete it
                                  if (event.title === '' && e.target.innerText.trim() === '') {
                                    handleDeleteCalendarEvent(event.id);
                                  } else {
                                    // Otherwise just blur the input
                                    e.target.blur();
                                  }
                                }
                              }}
                              style={{
                                margin: 0,
                                fontSize: 16,
                                color: "#fff",
                                outline: 'none',
                                cursor: "text",
                                padding: "2px 0px",
                                borderRadius: "4px",
                                transition: "background-color 0.2s",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                whiteSpace: "pre-wrap",
                                minHeight: "24px",
                                "&:hover": {
                                  backgroundColor: "rgba(255, 255, 255, 0.1)"
                                },
                                ...(duration <= 1 && { textAlign: "start" }) // Center text if duration is 1 hour or less
                              }}
                            >
                              {event.title}
                            </p>
                            <p style={{margin: 0, fontSize: 14, color: "#fff",  opacity: 0.8, ...(duration <= 1 && { textAlign: "start" })}}>
                              {formatTime(eventStart)} - {formatTime(eventEnd)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Time Grid */}
                {(() => {
                  // Safety check for selectedEvent and valid dates
                  if (!selectedEvent?.startTime || !selectedEvent?.endTime) {
                    return null;
                  }

                  const startDate = new Date(selectedEvent.startTime);
                  const endDate = new Date(selectedEvent.endTime);
                  const hoursDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60));

                  if (!hoursDiff || hoursDiff < 0 || !Number.isFinite(hoursDiff)) {
                    return null;
                  }

                  return Array.from({ length: hoursDiff }).map((_, index) => {
                    const cellTime = new Date(startDate.getTime() + (index * 60 * 60 * 1000));
                    const isFirstCell = index === 0;
                    const previousCellTime = index > 0 
                      ? new Date(startDate.getTime() + ((index - 1) * 60 * 60 * 1000))
                      : null;
                    const dayChanged = previousCellTime && 
                      cellTime.getUTCDate() !== previousCellTime.getUTCDate();

                    const showDayLabel = isFirstCell || dayChanged;
                    const dayLabel = cellTime.toLocaleString('en-US', { 
                      weekday: 'short', 
                      timeZone: 'UTC'
                    }).toUpperCase();

                    return (
                      <div key={index} style={{
                        width: "100%",
                        position: "relative",
                        height: 75,
                        borderBottom: "1px solid #EBEBEB",
                        flexShrink: 0
                      }}>
                        <p style={{
                          position: "absolute",
                          fontSize: 9,
                          paddingLeft: 2,
                          width: 28,
                          marginTop: -6,
                          backgroundColor: "#fff",
                          userSelect: "none",
                          color: "#A2A2A2"
                        }}>
                          {showDayLabel && (
                            <span style={{ display: 'block' }}>{dayLabel}</span>
                          )}
                          {cellTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            timeZone: 'UTC',
                            hour12: true 
                          })}
                        </p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        }
        {(currentTab != "Run of Show" && currentTab != "Schedule")&& 

        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          color: "#59636E"
        }}>
          {currentTab}
        </div>
        }
      </div>
    </>
  );
}
