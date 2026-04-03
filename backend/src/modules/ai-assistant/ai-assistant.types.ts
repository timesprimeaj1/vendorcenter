export type Intent = "GREETING" | "SERVICE_SEARCH" | "RECOMMENDATION" | "BOOKING" | "MY_BOOKINGS" | "AVAILABLE_SERVICES" | "FAQ" | "COMPLAINT" | "RESCHEDULE" | "CANCEL_BOOKING" | "REFUND" | "VENDOR_INFO" | "LOCATION" | "UNKNOWN";
export type Action = "SHOW_RESULTS" | "GET_RECOMMENDATIONS" | "BOOK_SERVICE" | "SHOW_MY_BOOKINGS" | "SHOW_CATEGORIES" | "ASK_LOCATION" | "ASK_DETAILS" | "NAVIGATE" | "NONE";
export type AssistantMode = "CHAT" | "SYSTEM";
export type AssistantProvider = "gemini" | "groq" | "static" | "embedding" | "self-hosted";

export interface VendorResult {
  name: string;
  vendorId: string;
  rating: string;
  distance: string;
  price_range: string;
  availability: string;
  categories: string[];
  completedBookings: number;
  rankScore: number;
}

export interface AssistantResponse {
  intent: Intent;
  message: string;
  vendors: VendorResult[];
  action: Action;
  followUp?: string;
  service?: string;
  location?: string;
  confidence?: number;
  mode?: AssistantMode;
  provider?: AssistantProvider;
  navigateTo?: string;
}

export interface AssistantQuery {
  message: string;
  lat?: number;
  lng?: number;
  conversationId?: string;
}

export interface ConversationTurn {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface ToolCallResult {
  toolName: string;
  result: unknown;
}

export interface AssistantDecision {
  mode: AssistantMode;
  intent: Intent;
  service: string;
  location: string;
  action: Action;
  message: string;
  confidence: number;
  provider: AssistantProvider;
  rawText: string;
  navigateTo: string;
}
