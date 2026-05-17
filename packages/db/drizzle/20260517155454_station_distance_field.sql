CREATE OR REPLACE FUNCTION public.station_distance(
  station public.stations,
  reference_system_id uuid
)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  reference_position cube;
  station_position cube;
BEGIN
  SELECT s.position
  INTO reference_position
  FROM public.systems s
  WHERE s.id = reference_system_id;

  IF reference_position IS NULL THEN
    RAISE EXCEPTION 'Reference system not found: %', reference_system_id
      USING ERRCODE = '22023';
  END IF;

  SELECT s.position
  INTO station_position
  FROM public.systems s
  WHERE s.id = station."systemId";

  IF station_position IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN cube_distance(station_position, reference_position);
END;
$$;
