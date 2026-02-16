<script lang="ts">
	import { userStore } from '$lib/stores/UserStore.svelte';
	import { onMount } from 'svelte';

	interface Props {
		isOpen?: boolean;
		onClose?: () => void;
	}

	let { isOpen = false, onClose }: Props = $props();

	async function handleNotificationClick(notification: UserNotification) {
		if (!notification.read) {
			await userStore.markNotificationAsRead(notification.id);
		}

		// Handle navigation based on notification type
		switch (notification.type) {
			case 'follow_request':
				// Navigate to follow requests or user profile
				console.log('Navigate to follow requests');
				break;
			case 'follow_accepted':
				// Navigate to user profile
				console.log('Navigate to user profile:', notification.fromUserId);
				break;
			case 'story_mention':
				// Navigate to story
				console.log('Navigate to story:', notification.itemId);
				break;
			default:
				console.log('Handle notification:', notification);
		}
	}

	async function handleMarkAllAsRead() {
		try {
			await userStore.markAllNotificationsAsRead();
		} catch (error) {
			console.error('Failed to mark all as read:', error);
		}
	}

	function getNotificationIcon(type: NotificationType): string {
		switch (type) {
			case 'follow_request':
				return '👤';
			case 'follow_accepted':
				return '✅';
			case 'story_mention':
				return '📝';
			case 'activity_like':
				return '❤️';
			case 'new_follower_activity':
				return '🔔';
			default:
				return '📬';
		}
	}

	function formatRelativeTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days > 0) {
			return `${days}d`;
		} else if (hours > 0) {
			return `${hours}h`;
		} else if (minutes > 0) {
			return `${minutes}m`;
		} else {
			return 'now';
		}
	}

	// Handle escape key to close
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && onClose) {
			onClose();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if isOpen}
	<!-- Overlay -->
	<div class="bg-opacity-50 fixed inset-0 z-40 bg-black" onclick={onClose} aria-hidden="true"></div>

	<!-- Panel -->
	<div class="fixed top-0 right-0 z-50 flex h-full w-96 flex-col bg-white shadow-2xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
			<h2 class="text-lg font-semibold text-gray-900">Notifications</h2>
			<div class="flex items-center space-x-2">
				{#if userStore.unreadNotificationCount > 0}
					<button
						onclick={handleMarkAllAsRead}
						onkeydown={(e) => e.key === 'Enter' && handleMarkAllAsRead()}
						class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
						tabindex="0"
						aria-label="Mark all notifications as read"
					>
						Mark all read
					</button>
				{/if}
				<button
					onclick={onClose}
					onkeydown={(e) => e.key === 'Enter' && onClose?.()}
					class="text-xl text-gray-400 hover:text-gray-600"
					tabindex="0"
					aria-label="Close notifications panel"
				>
					×
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			{#if userStore.notificationsLoading}
				<div class="flex items-center justify-center p-8">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
					></div>
					<span class="ml-2 text-gray-600">Loading notifications...</span>
				</div>
			{:else if userStore.notifications.length === 0}
				<div class="p-8 text-center">
					<div class="mb-4 text-4xl text-gray-400">🔔</div>
					<div class="text-lg text-gray-500">No notifications</div>
					<div class="mt-2 text-sm text-gray-400">
						When someone follows you or mentions you, you'll see it here
					</div>
				</div>
			{:else}
				<div class="divide-y divide-gray-100">
					{#each userStore.notifications as notification (notification.id)}
						<button
							onclick={() => handleNotificationClick(notification)}
							onkeydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
							class="w-full p-4 text-left transition-colors hover:bg-gray-50 {notification.read
								? 'opacity-75'
								: 'bg-blue-50'}"
							tabindex="0"
							aria-label="Open notification: {notification.message}"
						>
							<div class="flex items-start space-x-3">
								<!-- Icon -->
								<div class="flex-shrink-0 text-lg">
									{getNotificationIcon(notification.type)}
								</div>

								<!-- Content -->
								<div class="min-w-0 flex-1">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<!-- User info if available -->
											{#if notification.fromUserDisplayName}
												<div class="mb-1 flex items-center space-x-2">
													{#if notification.fromUserAvatarUrl}
														<img
															src={notification.fromUserAvatarUrl}
															alt="{notification.fromUserDisplayName}'s avatar"
															class="h-6 w-6 rounded-full object-cover"
														/>
													{:else}
														<div
															class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600"
														>
															{notification.fromUserDisplayName.charAt(0).toUpperCase()}
														</div>
													{/if}
													<span class="text-sm font-medium text-gray-900">
														{notification.fromUserDisplayName}
													</span>
													{#if notification.fromUserUsername}
														<span class="text-sm text-gray-500">
															@{notification.fromUserUsername}
														</span>
													{/if}
												</div>
											{/if}

											<!-- Message -->
											<p class="text-sm text-gray-800">
												{notification.message}
											</p>
										</div>

										<!-- Time and unread indicator -->
										<div class="ml-2 flex items-center space-x-2">
											<span class="text-xs text-gray-500">
												{formatRelativeTime(notification.dateCreated)}
											</span>
											{#if !notification.read}
												<div class="h-2 w-2 rounded-full bg-blue-500"></div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		{#if userStore.notifications.length > 0}
			<div class="border-t border-gray-200 bg-gray-50 p-4">
				<div class="text-center text-sm text-gray-500">
					{userStore.unreadNotificationCount} unread of {userStore.notifications.length} total
				</div>
			</div>
		{/if}
	</div>
{/if}
