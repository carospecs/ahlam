-- Clean up existing "Left/Right" mislabels on centerline parts in ai_output
-- and corrected JSONB columns of listings that were created before the improved
-- CENTER_PART regex was deployed.

-- Strip leading "Left " / "Right " / "Lh " / "Rh " from partName inside
-- ai_output and corrected JSON for centerline parts.
CREATE TEMP TABLE center_parts_list (name TEXT) ON COMMIT DROP;
INSERT INTO center_parts_list VALUES
  ('Alternator'), ('Starter'), ('A/C Compressor'), ('AC Compressor'), ('Compressor'),
  ('ABS Module'), ('ABS Control Module'), ('ABS Pump'), ('ABS Unit'),
  ('Battery'), ('Radiator'), ('Radiator Fan'), ('Radiator Fan Assembly'),
  ('Condenser'), ('Evaporator'), ('Heater Core'), ('Blower Motor'),
  ('Turbocharger'), ('Turbo'), ('Intercooler'),
  ('Engine'), ('Transmission'), ('Transfer Case'), ('Differential'),
  ('Drive Shaft'), ('CV Axle'), ('Axle Shaft'), ('Propeller Shaft'),
  ('ECU'), ('ECM'), ('PCM'), ('TCM'), ('Engine Control Unit'), ('Engine Control Module'),
  ('Fuel Pump'), ('Fuel Injector'), ('Fuel Rail'), ('Throttle Body'),
  ('Mass Airflow Sensor'), ('MAF Sensor'), ('Oxygen Sensor'), ('O2 Sensor'),
  ('Knock Sensor'), ('Crankshaft Sensor'), ('Camshaft Sensor'), ('Speed Sensor'),
  ('Ignition Coil'), ('Distributor'), ('Coil Pack'),
  ('Starter Solenoid'), ('Voltage Regulator'), ('Alternator Rectifier'),
  ('Wiring Harness'), ('Engine Wiring Harness'), ('Engine Harness'),
  ('Fuse Box'), ('Fuse Block'), ('Relay Box'), ('Power Distribution Box'),
  ('Water Pump'), ('Power Steering Pump'), ('Oil Pump'),
  ('Thermostat'), ('Thermostat Housing'),
  ('Serpentine Belt'), ('Timing Belt'), ('Timing Chain'),
  ('Motor Mount'), ('Transmission Mount'),
  ('Exhaust Manifold'), ('Catalytic Converter'), ('Muffler');

DO $$
DECLARE
  cleaned INT := 0;
  rec RECORD;
  new_ai JSONB;
  new_corrected JSONB;
  pn TEXT;
  cleaned_pn TEXT;
  is_center BOOLEAN;
BEGIN
  FOR rec IN SELECT id, ai_output, corrected FROM listings WHERE (ai_output->>'partName' ~* '^(Left |Right |Lh |Rh )') OR (corrected->>'partName' ~* '^(Left |Right |Lh |Rh )') LOOP
    new_ai := rec.ai_output;
    new_corrected := rec.corrected;

    -- Strip side prefix from ai_output partName if it matches a center part
    IF new_ai ? 'partName' THEN
      pn := new_ai->>'partName';
      cleaned_pn := trim(REGEXP_REPLACE(pn, '^(Left |Right |Lh |Rh )', '', 'i'));
      IF cleaned_pn <> pn THEN
        SELECT EXISTS (SELECT 1 FROM center_parts_list WHERE name = cleaned_pn) INTO is_center;
        IF is_center THEN
          new_ai := jsonb_set(new_ai, '{partName}', to_jsonb(cleaned_pn));
        END IF;
      END IF;
    END IF;

    -- Strip side prefix from corrected partName
    IF new_corrected ? 'partName' THEN
      pn := new_corrected->>'partName';
      cleaned_pn := trim(REGEXP_REPLACE(pn, '^(Left |Right |Lh |Rh )', '', 'i'));
      IF cleaned_pn <> pn THEN
        SELECT EXISTS (SELECT 1 FROM center_parts_list WHERE name = cleaned_pn) INTO is_center;
        IF is_center THEN
          new_corrected := jsonb_set(new_corrected, '{partName}', to_jsonb(cleaned_pn));
        END IF;
      END IF;
    END IF;

    IF new_ai <> rec.ai_output OR new_corrected <> rec.corrected THEN
      UPDATE listings SET ai_output = new_ai, corrected = new_corrected WHERE id = rec.id;
      cleaned := cleaned + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Cleaned % listing(s) with mislabeled side prefixes on centerline parts', cleaned;
END $$;
