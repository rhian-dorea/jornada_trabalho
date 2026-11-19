export const dayPeople = (employees, selectedId) => selectedId
  ? employees.filter(employee => employee.id === selectedId)
  : employees;

export const showCoverageAlert = (visibleWorking, missing) => visibleWorking > 0 && missing > 0;

// Índice visual: segunda = 0, domingo = 6; getDay() mantém seu significado nativo.
export const mondayOffset = date => (date.getDay() + 6) % 7;
