import { DemandResponseDto } from 'src/app/gohappygobackend/models/demand-response-dto';
import { RequestResponseDto } from 'src/app/gohappygobackend/models/request-response-dto';
import { TransactionResponseDto } from 'src/app/gohappygobackend/models/transaction-response-dto';
import { TravelResponseDto } from 'src/app/gohappygobackend/models/travel-response-dto';
import { UserProfileResponseDto } from 'src/app/gohappygobackend/models/user-profile-response-dto';

export interface UserReviewRow {
  id: number;
  rating: string | number;
  comment: string;
  createdAt: string;
  counterparty?: string;
}

export interface UserSupportRow {
  id: number;
  category: string;
  status: string;
  subject?: string;
  createdAt: string;
}

export interface UserTransactionRow extends TransactionResponseDto {
  role: 'Payer' | 'Payee' | 'Payer & Payee';
}

export interface UserDetailsState {
  isDeactivated?: boolean;
  rating?: number | null;
  numberOfReviews?: number;
}

export interface UserDetailsExportPayload {
  profile: UserProfileResponseDto;
  accountStatus: string;
  demands: DemandResponseDto[];
  travels: TravelResponseDto[];
  requests: RequestResponseDto[];
  transactions: UserTransactionRow[];
  reviewsGiven: UserReviewRow[];
  reviewsReceived: UserReviewRow[];
  supportTickets: UserSupportRow[];
}
