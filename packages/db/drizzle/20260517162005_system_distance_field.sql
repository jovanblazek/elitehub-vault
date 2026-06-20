CREATE OR REPLACE FUNCTION public.system_distance(
  system public.systems,
  reference_system_id uuid
)
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  SELECT cube_distance(system.position, reference_system.position)
  FROM public.systems AS reference_system
  WHERE reference_system.id = reference_system_id;
$$;
