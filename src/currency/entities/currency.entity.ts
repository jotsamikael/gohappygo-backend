import { BaseEntity } from 'src/baseEntity/base.entity';
import { UserEntity } from 'src/user/user.entity';
import { Column, Entity, OneToMany } from 'typeorm';

/*
 * Represents a currency in the system
 * Stores currency code, name, symbol, and related information
 */
@Entity()
export class CurrencyEntity extends BaseEntity {
  @Column({ unique: true, length: 3 })
  code: string; // ISO 4217 currency code (e.g., USD, EUR, GBP)

  @Column()
  name: string; // Full currency name (e.g., US Dollar, Euro)

  @Column({ length: 10 })
  symbol: string; // Currency symbol (e.g., $, €, £)

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 1.0 })
  exchangeRate: number; // Exchange rate relative to base currency

  @Column({ default: true })
  isActive: boolean; // Whether the currency is currently active

  @Column({ nullable: true })
  country: string; // Primary country using this currency

  @OneToMany(() => UserEntity, (user) => user.currency)
  users: UserEntity[];
}
