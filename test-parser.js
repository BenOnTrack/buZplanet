import { parseOpeningHours } from './src/lib/utils/opening-hours-parser.ts';

// Test the problematic opening hours string
const testString = 'Mo-fr 07:00-22:00; Sa-Su,PH 07:00-21:00';
console.log('Testing:', testString);

const result = parseOpeningHours(testString);
console.log('Result:', JSON.stringify(result, null, 2));

// Test another variation
const testString2 = 'Mo-Fr 07:00-22:00, Sa-Su,PH 07:00-21:00';
console.log('\nTesting:', testString2);

const result2 = parseOpeningHours(testString2);
console.log('Result:', JSON.stringify(result2, null, 2));
