import { TransactionEntity } from "./transaction.entity";
import { TransactionResponseDto } from "./dto/transaction-response.dto";
import { UserEntity } from "src/user/user.entity";
import { CommonService } from "src/common/service/common.service";

export class TransactionMapper {
    constructor(private readonly commonService: CommonService) {}

    toResponseDto(transaction: TransactionEntity, currentUser?: UserEntity): TransactionResponseDto {
        // Calculate showReleaseFundButton based on the logic:
        // Show button if ALL are true:
        // 1. Status is 'paid' OR 'awaiting_transfer'
        // 2. stripeTransferId is null (transfer not yet created)
        // 3. User is the payee (not the payer)
        let showReleaseFundButton = false;
        
        if (currentUser) {
            const isPayee = transaction.payeeId === currentUser.id;
            const isEligibleStatus = transaction.status === 'paid' || transaction.status === 'awaiting_transfer';
            const hasNoTransfer = transaction.stripeTransferId === null;
            
            showReleaseFundButton = isPayee && isEligibleStatus && hasNoTransfer;
        }

        return {
            id: transaction.id,
            publicId: transaction.publicId,
            payerId: transaction.payerId,
            payeeId: transaction.payeeId,
            requestId: transaction.requestId,
            amount: Number(transaction.amount),
            originalAmount: transaction.originalAmount ? Number(transaction.originalAmount) : null,
            convertedAmount: transaction.convertedAmount ? Number(transaction.convertedAmount) : null,
            travelerPayment: transaction.travelerPayment ? Number(transaction.travelerPayment) : null,
            status: transaction.status,
            paymentMethod: transaction.paymentMethod,
            currencyCode: transaction.currencyCode,
            stripePaymentIntentId: transaction.stripePaymentIntentId || null,
            stripeTransferId: transaction.stripeTransferId || null,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
            payer: transaction.payer ? {
                id: transaction.payer.id,
                publicId: transaction.payer?.publicId ?? '',
                email: transaction.payer.email,
                fullName: transaction.payer.username,
            } : null,
            payee: transaction.payee ? {
                id: transaction.payee.id,
                publicId: transaction.payee?.publicId ?? '',
                email: transaction.payee.email,
                fullName: transaction.payee.username,
            } : null,
            request: transaction.request ? {
                id: transaction.request.id,
                publicId: transaction.request?.publicId ?? '',
                requestType: transaction.request.requestType,
                weight: transaction.request.weight ? Number(transaction.request.weight) : null,
            } : null,
            showReleaseFundButton,
        };
    }
}

