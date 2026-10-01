-- Las aplicaciones históricas aprobadas pueden existir sin movimiento de caja.
-- Toda parte con efecto de caja sigue exigiendo un movimiento y el límite del depósito.
CREATE OR REPLACE FUNCTION validate_payment_part_total() RETURNS trigger AS $$
DECLARE
  movement_id text;
  movement_amount integer;
  parts_total bigint;
BEGIN
  movement_id := COALESCE(NEW."movementId", OLD."movementId");
  IF movement_id IS NULL THEN
    IF (TG_OP = 'DELETE' AND OLD."isLegacy" AND NOT OLD."cashEffect")
       OR (TG_OP <> 'DELETE' AND NEW."isLegacy" AND NOT NEW."cashEffect") THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'Una parte con efecto de caja requiere movimiento';
  END IF;
  SELECT "amountCents" INTO movement_amount FROM "MoneyMovement" WHERE id = movement_id FOR UPDATE;
  IF movement_amount IS NULL THEN
    RAISE EXCEPTION 'Movimiento inexistente para la parte de pago';
  END IF;
  SELECT COALESCE(SUM("amountCents"), 0) INTO parts_total
    FROM "PaymentPart"
    WHERE "movementId" = movement_id
      AND (TG_OP = 'DELETE' OR id <> COALESCE(NEW.id, ''));
  IF TG_OP <> 'DELETE' THEN parts_total := parts_total + NEW."amountCents"; END IF;
  IF parts_total > movement_amount THEN
    RAISE EXCEPTION 'Las partes identificadas exceden el importe del movimiento';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
