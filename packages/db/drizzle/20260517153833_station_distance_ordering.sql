CREATE OR REPLACE FUNCTION public.stations_by_distance(reference_system_id uuid)
RETURNS SETOF public.stations
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  reference_position cube;
BEGIN
  SELECT s.position
  INTO reference_position
  FROM public.systems s
  WHERE s.id = reference_system_id;

  IF reference_position IS NULL THEN
    RAISE EXCEPTION 'Reference system not found: %', reference_system_id
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT station.*
  FROM public.stations station
  INNER JOIN public.systems station_system
    ON station_system.id = station."systemId"
  ORDER BY
    cube_distance(station_system.position, reference_position) ASC,
    station.id ASC;
END;
$$;
