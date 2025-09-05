// Test script to verify the date parsing fix
// This simulates what happens when a user selects a date

console.log('Testing date parsing fix...\n');

// Simulate user selecting January 15, 2024
const dateString = '2024-01-15';

// Old way (problematic)
const oldDate = new Date(dateString);
console.log('Old way (problematic):');
console.log(`Input: ${dateString}`);
console.log(`Parsed date: ${oldDate}`);
console.log(`Local date string: ${oldDate.toLocaleDateString()}`);
console.log(`ISO string: ${oldDate.toISOString()}`);
console.log(`Date only: ${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`);

console.log('\n---\n');

// New way (fixed)
const newDate = new Date(dateString + 'T00:00:00');
console.log('New way (fixed):');
console.log(`Input: ${dateString}`);
console.log(`Parsed date: ${newDate}`);
console.log(`Local date string: ${newDate.toLocaleDateString()}`);
console.log(`ISO string: ${newDate.toISOString()}`);
console.log(`Date only: ${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`);

console.log('\n---\n');

// Test with different timezones
console.log('Testing timezone consistency:');
const testDates = ['2024-01-01', '2024-06-15', '2024-12-31'];

testDates.forEach(dateStr => {
  const oldWay = new Date(dateStr);
  const newWay = new Date(dateStr + 'T00:00:00');
  
  console.log(`\nInput: ${dateStr}`);
  console.log(`Old way date: ${oldWay.getDate()}, New way date: ${newWay.getDate()}`);
  console.log(`Match: ${oldWay.getDate() === newWay.getDate() ? '✅' : '❌'}`);
});
