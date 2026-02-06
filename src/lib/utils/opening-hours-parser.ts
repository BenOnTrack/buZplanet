export interface OpeningHoursSchedule {
	originalText: string;
	is24_7: boolean;
	isClosed: boolean;
	days: {
		monday: TimeSlot[];
		tuesday: TimeSlot[];
		wednesday: TimeSlot[];
		thursday: TimeSlot[];
		friday: TimeSlot[];
		saturday: TimeSlot[];
		sunday: TimeSlot[];
	};
	notes: string[];
	error?: string;
}

export interface TimeSlot {
	start: number; // minutes from midnight (0-1439)
	end: number; // minutes from midnight (0-1440, where 1440 = next day midnight)
}

export function parseOpeningHours(openingHours: string): OpeningHoursSchedule {
	const result: OpeningHoursSchedule = {
		originalText: openingHours.trim(),
		is24_7: false,
		isClosed: false,
		days: {
			monday: [],
			tuesday: [],
			wednesday: [],
			thursday: [],
			friday: [],
			saturday: [],
			sunday: []
		},
		notes: []
	};

	if (!openingHours || openingHours.trim() === '') {
		result.error = 'No opening hours specified';
		return result;
	}

	const trimmed = openingHours.trim();

	// Handle special cases
	if (trimmed === '24/7') {
		result.is24_7 = true;
		// Set all days to 24 hours
		const fullDay = [{ start: 0, end: 1440 }];
		Object.keys(result.days).forEach((day) => {
			result.days[day as keyof typeof result.days] = fullDay;
		});
		return result;
	}

	if (trimmed.toLowerCase() === 'closed' || trimmed === 'off') {
		result.isClosed = true;
		return result;
	}

	try {
		// First, normalize the input by replacing commas between rule groups with semicolons
		// But be careful not to replace commas within time ranges
		const normalizedInput = normalizeRuleSeparators(trimmed);

		// Split by semicolon to get different rule groups
		const ruleGroups = normalizedInput
			.split(';')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const ruleGroup of ruleGroups) {
			parseRuleGroup(ruleGroup, result);
		}

		return result;
	} catch (error) {
		result.error = `Failed to parse: ${error instanceof Error ? error.message : 'Unknown error'}`;
		return result;
	}
}

function normalizeRuleSeparators(input: string): string {
	// If semicolons are already present, return as is
	if (input.includes(';')) {
		return input;
	}

	// For simple time-only formats, no normalization needed
	const timeOnlyPattern = /^\d{2}:\d{2}-\d{2}:\d{2}(,\s*\d{2}:\d{2}-\d{2}:\d{2})*$/;
	if (timeOnlyPattern.test(input)) {
		return input;
	}

	// For comma-separated formats, we need to intelligently split
	// Look for patterns like "days time, days time" and convert to "days time; days time"

	// First, handle cases where we have day ranges followed by times
	// Pattern: "Mo-Fr 07:00-22:00, Sa-Su,PH 07:00-21:00"
	const dayTimePattern =
		/([A-Za-z]{2}(-[A-Za-z]{2})?([,\s]*[A-Za-z]{2}(-[A-Za-z]{2})?|[,\s]*PH|[,\s]*SH)*)\s+(\d{2}:\d{2}-\d{2}:\d{2})/g;

	let result = input;
	const matches = [...input.matchAll(dayTimePattern)];

	if (matches.length > 1) {
		// We have multiple day-time groups, replace commas between them with semicolons
		result = matches.map((match) => match[0]).join('; ');
	}

	return result;
}

function parseRuleGroup(ruleGroup: string, result: OpeningHoursSchedule): void {
	// Handle "PH off" or "SH off" (public holidays, school holidays)
	if (ruleGroup.match(/^(PH|SH)\s+off$/i)) {
		if (ruleGroup.startsWith('PH')) {
			result.notes.push('Closed on public holidays');
		} else if (ruleGroup.startsWith('SH')) {
			result.notes.push('Closed on school holidays');
		}
		return;
	}

	// Handle special holiday hours like "PH 09:00-12:00"
	if (ruleGroup.match(/^(PH|SH)\s+\d{2}:\d{2}-\d{2}:\d{2}/i)) {
		const timeMatch = ruleGroup.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
		if (timeMatch) {
			const startTime = parseTime(timeMatch[1]);
			const endTime = parseTime(timeMatch[2]);
			if (ruleGroup.startsWith('PH')) {
				result.notes.push(`Public holidays: ${timeMatch[1]}-${timeMatch[2]}`);
			} else if (ruleGroup.startsWith('SH')) {
				result.notes.push(`School holidays: ${timeMatch[1]}-${timeMatch[2]}`);
			}
		}
		return;
	}

	// Check if this is a time-only format (e.g., "09:00-18:30" or "09:00-12:00,14:00-18:30")
	const timeOnlyPattern = /^\d{2}:\d{2}-\d{2}:\d{2}(,\s*\d{2}:\d{2}-\d{2}:\d{2})*$/;
	if (timeOnlyPattern.test(ruleGroup)) {
		// Apply to all days of the week
		const timeSlots = parseTimes(ruleGroup);
		const allDays: Array<keyof OpeningHoursSchedule['days']> = [
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday',
			'sunday'
		];
		for (const day of allDays) {
			result.days[day].push(...timeSlots);
		}
		return;
	}

	// Parse normal day/time rules
	const dayTimeMatch = ruleGroup.match(/^([A-Za-z,\-\s]+)\s+(.+)$/);
	if (!dayTimeMatch) {
		throw new Error(`Invalid rule format: ${ruleGroup}`);
	}

	const daysPart = dayTimeMatch[1].trim();
	const timesPart = dayTimeMatch[2].trim();

	// Check if this rule includes public holidays (PH) or school holidays (SH)
	const includesPH = daysPart.includes('PH');
	const includesSH = daysPart.includes('SH');

	if (includesPH) {
		const timeMatch = timesPart.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
		if (timeMatch) {
			result.notes.push(`Public holidays: ${timeMatch[1]}–${timeMatch[2]}`);
		} else {
			result.notes.push('Special hours apply on public holidays');
		}
	}

	if (includesSH) {
		const timeMatch = timesPart.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
		if (timeMatch) {
			result.notes.push(`School holidays: ${timeMatch[1]}–${timeMatch[2]}`);
		} else {
			result.notes.push('Special hours apply on school holidays');
		}
	}

	// Parse days (this will skip PH/SH)
	const days = parseDays(daysPart);

	// Parse times
	const timeSlots = parseTimes(timesPart);

	// Apply time slots to all specified days
	for (const day of days) {
		result.days[day].push(...timeSlots);
	}
}

function parseDays(daysPart: string): Array<keyof OpeningHoursSchedule['days']> {
	// Make day abbreviations case-insensitive
	const dayAbbreviations: Record<string, keyof OpeningHoursSchedule['days']> = {
		mo: 'monday',
		tu: 'tuesday',
		we: 'wednesday',
		th: 'thursday',
		fr: 'friday',
		sa: 'saturday',
		su: 'sunday'
	};

	const days: Array<keyof OpeningHoursSchedule['days']> = [];

	// Split by comma for individual days/ranges
	const parts = daysPart.split(',').map((s) => s.trim());

	for (const part of parts) {
		// Skip PH (public holidays) and SH (school holidays) as they're not regular days
		if (part.toUpperCase() === 'PH' || part.toUpperCase() === 'SH') {
			continue;
		}

		// Check for range (e.g., "Mo-Fr", "mo-fr")
		const rangeMatch = part.match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
		if (rangeMatch) {
			const startDay = dayAbbreviations[rangeMatch[1].toLowerCase()];
			const endDay = dayAbbreviations[rangeMatch[2].toLowerCase()];

			if (!startDay || !endDay) {
				throw new Error(`Invalid day abbreviation in range: ${part}`);
			}

			const dayOrder = [
				'monday',
				'tuesday',
				'wednesday',
				'thursday',
				'friday',
				'saturday',
				'sunday'
			];
			const startIndex = dayOrder.indexOf(startDay);
			const endIndex = dayOrder.indexOf(endDay);

			if (startIndex <= endIndex) {
				// Normal range (e.g., Mo-Fr)
				for (let i = startIndex; i <= endIndex; i++) {
					days.push(dayOrder[i] as keyof OpeningHoursSchedule['days']);
				}
			} else {
				// Wrap-around range (e.g., Sa-Mo)
				for (let i = startIndex; i < dayOrder.length; i++) {
					days.push(dayOrder[i] as keyof OpeningHoursSchedule['days']);
				}
				for (let i = 0; i <= endIndex; i++) {
					days.push(dayOrder[i] as keyof OpeningHoursSchedule['days']);
				}
			}
		} else {
			// Single day
			const day = dayAbbreviations[part.toLowerCase()];
			if (!day) {
				throw new Error(`Invalid day abbreviation: ${part}`);
			}
			days.push(day);
		}
	}

	return [...new Set(days)]; // Remove duplicates
}

function parseTimes(timesPart: string): TimeSlot[] {
	const timeSlots: TimeSlot[] = [];

	// Handle "off" (closed)
	if (timesPart.toLowerCase() === 'off') {
		return timeSlots; // Return empty array for closed days
	}

	// Split by comma for multiple time ranges
	const timeRanges = timesPart.split(',').map((s) => s.trim());

	for (const timeRange of timeRanges) {
		const rangeMatch = timeRange.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
		if (!rangeMatch) {
			throw new Error(`Invalid time range format: ${timeRange}`);
		}

		const startTime = parseTime(rangeMatch[1]);
		let endTime = parseTime(rangeMatch[2]);

		// Handle cases where end time is earlier than start time (next day)
		if (endTime <= startTime) {
			endTime += 1440; // Add 24 hours (next day)
		}

		timeSlots.push({
			start: startTime,
			end: endTime
		});
	}

	return timeSlots;
}

function parseTime(timeString: string): number {
	const match = timeString.match(/^(\d{2}):(\d{2})$/);
	if (!match) {
		throw new Error(`Invalid time format: ${timeString}`);
	}

	const hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);

	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
		throw new Error(`Invalid time values: ${timeString}`);
	}

	return hours * 60 + minutes;
}

// Utility function to check if a location is currently open
export function isCurrentlyOpen(schedule: OpeningHoursSchedule): boolean | null {
	if (schedule.error) return null;
	if (schedule.is24_7) return true;
	if (schedule.isClosed) return false;

	const now = new Date();
	const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
	const currentTime = now.getHours() * 60 + now.getMinutes();

	const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const todaySchedule = schedule.days[dayNames[currentDay] as keyof typeof schedule.days];

	if (!todaySchedule || todaySchedule.length === 0) {
		return false;
	}

	// Check if current time falls within any open period
	for (const period of todaySchedule) {
		if (currentTime >= period.start && currentTime < period.end) {
			return true;
		}
	}

	return false;
}

// Utility function to get next opening time
export function getNextOpening(
	schedule: OpeningHoursSchedule
): { day: string; time: string } | null {
	if (schedule.error || schedule.is24_7 || schedule.isClosed) return null;

	const now = new Date();
	const currentDay = now.getDay();
	const currentTime = now.getHours() * 60 + now.getMinutes();
	const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

	// Check remaining periods today
	const todaySchedule = schedule.days[dayNames[currentDay] as keyof typeof schedule.days];
	if (todaySchedule) {
		for (const period of todaySchedule) {
			if (period.start > currentTime) {
				return {
					day: 'today',
					time: formatMinutesToTime(period.start)
				};
			}
		}
	}

	// Check next 7 days
	for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
		const checkDay = (currentDay + daysAhead) % 7;
		const daySchedule = schedule.days[dayNames[checkDay] as keyof typeof schedule.days];

		if (daySchedule && daySchedule.length > 0) {
			const dayName = daysAhead === 1 ? 'tomorrow' : dayNames[checkDay];
			return {
				day: dayName,
				time: formatMinutesToTime(daySchedule[0].start)
			};
		}
	}

	return null;
}

function formatMinutesToTime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
