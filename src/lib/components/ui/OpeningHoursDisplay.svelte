<script lang="ts">
	import { onMount } from 'svelte';
	import { parseOpeningHours } from '$lib/utils/opening-hours-parser.js';

	type DayName = keyof OpeningHoursSchedule['days'];

	let {
		openingHours,
		showCurrentStatus = true,
		compact = false
	}: {
		openingHours: string;
		showCurrentStatus?: boolean;
		compact?: boolean;
	} = $props();

	let schedule = $state<OpeningHoursSchedule | null>(null);
	let isOpen = $state<boolean | null>(null);
	let currentStatus = $state<string>('');
	let dropdownOpen = $state(false);

	// Parse opening hours when the prop changes
	$effect(() => {
		if (openingHours) {
			const parsed = parseOpeningHours(openingHours);
			schedule = parsed;
			updateCurrentStatus(parsed);
		} else {
			schedule = null;
			isOpen = null;
			currentStatus = 'Hours not specified';
		}
	});

	function updateCurrentStatus(parsed: OpeningHoursSchedule) {
		if (parsed.error) {
			isOpen = null;
			currentStatus = 'Hours format not recognized';
			return;
		}

		if (parsed.is24_7) {
			isOpen = true;
			currentStatus = 'Open 24/7';
			return;
		}

		if (parsed.isClosed) {
			isOpen = false;
			currentStatus = 'Closed';
			return;
		}

		// Get current day and time
		const now = new Date();
		const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
		const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

		// Find current day in schedule
		const dayNames: DayName[] = [
			'sunday',
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday'
		];
		const currentDayName = dayNames[currentDay];
		const todaySchedule = parsed.days[currentDayName];

		if (!todaySchedule || todaySchedule.length === 0) {
			isOpen = false;
			currentStatus = 'Closed today';
			return;
		}

		// Check if currently open
		for (const period of todaySchedule) {
			if (currentTime >= period.start && currentTime < period.end) {
				isOpen = true;
				const closingTime = formatTime(period.end);
				currentStatus = `Open until ${closingTime}`;
				return;
			}
		}

		// Find next opening time
		isOpen = false;
		const nextOpening = findNextOpening(parsed, now);
		if (nextOpening) {
			currentStatus = `Closed • Opens ${nextOpening}`;
		} else {
			currentStatus = 'Closed';
		}
	}

	function findNextOpening(parsed: OpeningHoursSchedule, now: Date): string | null {
		const currentDay = now.getDay();
		const currentTime = now.getHours() * 60 + now.getMinutes();
		const dayNames: DayName[] = [
			'sunday',
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday'
		];

		// Check remaining periods today
		const todaySchedule = parsed.days[dayNames[currentDay]];
		if (todaySchedule) {
			for (const period of todaySchedule) {
				if (period.start > currentTime) {
					return `at ${formatTime(period.start)}`;
				}
			}
		}

		// Check next 7 days
		for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
			const checkDay = (currentDay + daysAhead) % 7;
			const daySchedule = parsed.days[dayNames[checkDay]];

			if (daySchedule && daySchedule.length > 0) {
				const openingTime = formatTime(daySchedule[0].start);
				if (daysAhead === 1) {
					return `tomorrow at ${openingTime}`;
				} else {
					return `${dayNames[checkDay]} at ${openingTime}`;
				}
			}
		}

		return null;
	}

	function formatTime(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
	}

	function formatTimeRange(start: number, end: number): string {
		if (end === 1440) {
			// Midnight next day
			return `${formatTime(start)}–24:00`;
		}
		return `${formatTime(start)}–${formatTime(end)}`;
	}

	function getDayDisplayName(day: string): string {
		const names: Record<DayName, string> = {
			monday: 'Monday',
			tuesday: 'Tuesday',
			wednesday: 'Wednesday',
			thursday: 'Thursday',
			friday: 'Friday',
			saturday: 'Saturday',
			sunday: 'Sunday'
		};
		return names[day as DayName] || day;
	}

	function isToday(dayName: string): boolean {
		const now = new Date();
		const currentDay = now.getDay();
		const dayNames: DayName[] = [
			'sunday',
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday'
		];
		return dayNames[currentDay] === dayName;
	}

	// Handle click outside to close dropdown
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Element;
		if (!target.closest('[data-dropdown-container]')) {
			dropdownOpen = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="opening-hours-display" data-dropdown-container>
	{#if compact}
		<!-- Compact display for small spaces -->
		<div class="compact-display">
			{#if showCurrentStatus && isOpen !== null}
				<div class="status-indicator {isOpen ? 'open' : 'closed'}">
					<span class="status-dot"></span>
					<span class="status-text">{currentStatus}</span>
				</div>
			{:else}
				<span class="hours-text">{schedule?.originalText || openingHours}</span>
			{/if}
		</div>
	{:else}
		<!-- Full display -->
		<div class="full-display">
			<div class="header">
				<div class="title-row">
					<span class="icon">🕐</span>
					<span class="title">Opening Hours</span>
					{#if showCurrentStatus && isOpen !== null}
						<div class="status-badge {isOpen ? 'open' : 'closed'}">
							{isOpen ? 'Open Now' : 'Closed'}
						</div>
					{/if}
				</div>
				{#if schedule && !schedule.error && !schedule.is24_7 && !schedule.isClosed}
					<button
						class="dropdown-toggle"
						onclick={() => (dropdownOpen = !dropdownOpen)}
						onkeydown={(e) => e.key === 'Enter' && (dropdownOpen = !dropdownOpen)}
						aria-expanded={dropdownOpen}
						aria-label="Toggle detailed schedule"
					>
						<span class="status-text">
							{currentStatus}
							{#if schedule.notes.some((note) => note.toLowerCase().includes('public holiday'))}
								<span class="ph-indicator" title="Special hours on public holidays">(PH)</span>
							{/if}
						</span>
						<span class="chevron {dropdownOpen ? 'open' : ''}">▼</span>
					</button>
				{:else}
					<p class="status-text">
						{currentStatus}
						{#if schedule && schedule.notes.some((note) => note
									.toLowerCase()
									.includes('public holiday'))}
							<span class="ph-indicator" title="Special hours on public holidays">(PH)</span>
						{/if}
					</p>
				{/if}
			</div>

			{#if dropdownOpen && schedule && !schedule.error && !schedule.is24_7 && !schedule.isClosed}
				<div class="schedule-dropdown">
					<div class="schedule-table">
						<div class="schedule-header">
							<span class="day-column">Day</span>
							<span class="hours-column">Hours</span>
						</div>
						{#each Object.entries(schedule.days) as [day, periods]}
							<div class="schedule-row {isToday(day) ? 'today' : ''}">
								<span class="day-name">{getDayDisplayName(day)}</span>
								<span class="day-hours">
									{#if periods.length === 0}
										<span class="closed-text">Closed</span>
									{:else if periods.length === 1 && periods[0].start === 0 && periods[0].end === 1440}
										<span class="open-24h">24 hours</span>
									{:else}
										{#each periods as period, i}
											<span class="time-range">
												{formatTimeRange(period.start, period.end)}
											</span>
											{#if i < periods.length - 1}
												<span class="period-separator">, </span>
											{/if}
										{/each}
									{/if}
								</span>
							</div>
						{/each}
					</div>

					{#if schedule.notes && schedule.notes.length > 0}
						<div class="schedule-notes">
							{#each schedule.notes as note}
								<p
									class="note {note.toLowerCase().includes('public holiday')
										? 'public-holiday'
										: ''}"
								>
									{#if note.toLowerCase().includes('public holiday')}
										⚠️ {note}
									{:else}
										{note}
									{/if}
								</p>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.opening-hours-display {
		position: relative;
	}

	/* Compact display styles */
	.compact-display {
		display: flex;
		align-items: center;
		font-size: 0.875rem;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-indicator.open .status-dot {
		background-color: #10b981;
	}

	.status-indicator.closed .status-dot {
		background-color: #ef4444;
	}

	.status-text {
		color: #6b7280;
	}

	.hours-text {
		color: #6b7280;
		font-size: 0.875rem;
	}

	/* Full display styles */
	.full-display {
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background-color: #f9fafb;
		padding: 0.75rem;
	}

	.header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon {
		font-size: 1rem;
	}

	.title {
		font-weight: 600;
		color: #374151;
		flex: 1;
	}

	.status-badge {
		border-radius: 9999px;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.open {
		background-color: #d1fae5;
		color: #065f46;
	}

	.status-badge.closed {
		background-color: #fee2e2;
		color: #991b1b;
	}

	.dropdown-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: none;
		border: none;
		padding: 0.25rem 0;
		cursor: pointer;
		color: #6b7280;
		font-size: 0.875rem;
	}

	.dropdown-toggle:hover {
		color: #374151;
	}

	.dropdown-toggle:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
		border-radius: 0.25rem;
	}

	.chevron {
		transition: transform 0.2s ease;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.ph-indicator {
		color: #dc2626;
		font-weight: 600;
		font-size: 0.75rem;
		margin-left: 0.5rem;
	}

	.schedule-dropdown {
		margin-top: 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		background-color: white;
		overflow: hidden;
	}

	.schedule-table {
		display: flex;
		flex-direction: column;
	}

	.schedule-header {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 0.75rem;
		padding: 0.75rem;
		background-color: #f3f4f6;
		border-bottom: 1px solid #e5e7eb;
		font-weight: 600;
		font-size: 0.8125rem;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.schedule-row {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 0.75rem;
		padding: 0.75rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.schedule-row:last-child {
		border-bottom: none;
	}

	.schedule-row.today {
		background-color: #eff6ff;
		font-weight: 600;
	}

	.day-name {
		color: #374151;
		font-size: 0.875rem;
	}

	.day-hours {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		color: #6b7280;
		font-size: 0.875rem;
	}

	.time-range {
		font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
	}

	.period-separator {
		color: #9ca3af;
		margin: 0 0.25rem;
	}

	.closed-text {
		color: #9ca3af;
		font-style: italic;
	}

	.open-24h {
		color: #059669;
		font-weight: 600;
	}

	.schedule-notes {
		padding: 0.75rem;
		background-color: #fefce8;
		border-top: 1px solid #ede9fe;
	}

	.note {
		margin: 0;
		font-size: 0.8125rem;
		color: #a16207;
	}

	.note.public-holiday {
		color: #dc2626;
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.25rem;
		padding: 0.5rem;
		font-weight: 600;
	}

	.note + .note {
		margin-top: 0.25rem;
	}

	.note.public-holiday + .note,
	.note + .note.public-holiday {
		margin-top: 0.5rem;
	}
</style>
