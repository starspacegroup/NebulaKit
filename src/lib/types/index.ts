/**
 * Common types used throughout the application
 */

export interface User {
	id: string;
	email: string;
	name?: string;
	createdAt: Date;
}

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

export interface OAuthAccount {
	id: string;
	userId: string;
	provider: 'google' | 'github' | string;
	providerAccountId: string;
	accessToken?: string;
	refreshToken?: string;
	expiresAt?: Date;
}

export type ThemeMode = 'light' | 'dark';

export interface Command {
	id: string;
	label: string;
	description: string;
	action: () => void;
	icon: string;
	keywords?: string[];
}
