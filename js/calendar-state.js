export const dayPeople = (employees, selectedId) => selectedId
  ? employees.filter(employee => employee.id === selectedId)
  : employees;

export const showCoverageAlert = (visibleWorking, missing) => visibleWorking > 0 && missing > 0;
