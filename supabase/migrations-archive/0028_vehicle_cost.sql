-- What the yard paid to acquire the vehicle, in cents (matches orders.amount_cents).
-- Powers the sold/profit view: profit = revenue from sold parts − this cost.
-- Nullable: existing cars simply have no cost recorded until the owner enters one.
alter table vehicles add column if not exists acquisition_cost_cents int;
