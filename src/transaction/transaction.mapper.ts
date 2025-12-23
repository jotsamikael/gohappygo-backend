import { TransactionEntity } from "./transaction.entity";
import { TransactionResponseDto } from "./dto/transaction-response.dto";

export class TransactionMapper {
    toResponseDto(transaction: TransactionEntity): TransactionResponseDto {
        return {
            id: transaction.id,
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
                email: transaction.payer.email,
                firstName: transaction.payer.firstName,
                lastName: transaction.payer.lastName,
            } : null,
            payee: transaction.payee ? {
                id: transaction.payee.id,
                email: transaction.payee.email,
                firstName: transaction.payee.firstName,
                lastName: transaction.payee.lastName,
            } : null,
            request: transaction.request ? {
                id: transaction.request.id,
                requestType: transaction.request.requestType,
                weight: transaction.request.weight ? Number(transaction.request.weight) : null,
            } : null,
        };
    }
}

