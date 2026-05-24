extends Node3D

const ROAD_HEIGHT := 0.04
const DEFAULT_ROAD_WIDTH := 9.0
const MIN_DRIVABLE_ROAD_WIDTH := 14.0
const WORLD_SCALE := 1.0

var road_segments: Array[Dictionary] = []
var collision_zones: Array[Dictionary] = []
var spawn_position := Vector3.ZERO
var spawn_heading := 0.0

var asphalt_material := _make_material(Color(0.035, 0.055, 0.05), 0.9)
var sidewalk_material := _make_material(Color(0.92, 0.88, 0.72), 0.95)
var plaza_material := _make_material(Color(0.82, 0.74, 0.48), 0.98)
var paving_material := _make_material(Color(0.74, 0.67, 0.43, 0.42), 0.98)
var roof_material := _make_material(Color(0.74, 0.28, 0.16), 0.78)
var junction_material := _make_material(Color(0.028, 0.045, 0.042), 0.9)
var lane_material := _make_material(Color(0.82, 0.72, 0.34), 0.66)
var crosswalk_material := _make_material(Color(0.94, 0.93, 0.85), 0.72)
var window_material := _make_material(Color(0.05, 0.22, 0.28), 0.45)
var awning_material := _make_material(Color(0.9, 0.16, 0.12), 0.62)
var bench_material := _make_material(Color(0.58, 0.27, 0.11), 0.82)
var lamp_material := _make_material(Color(0.08, 0.08, 0.07), 0.7)
var building_materials := [
	_make_material(Color(0.86, 0.68, 0.48), 0.82),
	_make_material(Color(0.91, 0.79, 0.59), 0.82),
	_make_material(Color(0.76, 0.53, 0.38), 0.82),
	_make_material(Color(0.93, 0.86, 0.69), 0.82)
]
var leaf_materials := [
	_make_material(Color(0.13, 0.43, 0.19), 0.88),
	_make_material(Color(0.27, 0.58, 0.22), 0.88),
	_make_material(Color(0.43, 0.65, 0.28), 0.9)
]
var trunk_material := _make_material(Color(0.38, 0.22, 0.12), 0.9)

func generate(slice: Dictionary) -> void:
	_clear_children()
	_add_ground(slice)

	var roads: Array = slice.get("roads", _fallback_roads())
	var compiled_segments: Array = slice.get("roadSegments", [])
	if compiled_segments.size() > 0:
		_add_compiled_roads(compiled_segments, slice.get("junctions", []))
	else:
		_add_roads(roads)
	_add_buildings(slice.get("buildings", []))
	var props: Array = slice.get("props", [])
	_add_greenery(slice.get("green", []), roads, props.is_empty())
	_add_compiled_props(props)
	_add_toy_landmarks()
	_compute_spawn(slice)

func get_spawn_position() -> Vector3:
	return spawn_position

func get_spawn_heading() -> float:
	return spawn_heading

func get_road_segments() -> Array[Dictionary]:
	return road_segments

func get_collision_zones() -> Array[Dictionary]:
	return collision_zones

func _add_ground(slice: Dictionary) -> void:
	var bounds: Dictionary = slice.get("playableBounds", {
		"minX": -520,
		"maxX": 520,
		"minZ": -380,
		"maxZ": 535
	})
	var width := float(bounds.maxX - bounds.minX)
	var depth := float(bounds.maxZ - bounds.minZ)
	var ground := MeshInstance3D.new()
	ground.name = "CalçadaGround"
	ground.mesh = PlaneMesh.new()
	ground.mesh.size = Vector2(width, depth)
	ground.material_override = plaza_material
	ground.position = Vector3((bounds.minX + bounds.maxX) * 0.5, -0.02, (bounds.minZ + bounds.maxZ) * 0.5)
	add_child(ground)

	var center := ground.position
	for i in range(-9, 10):
		var stripe := MeshInstance3D.new()
		stripe.name = "CalçadaGrain"
		stripe.mesh = BoxMesh.new()
		stripe.mesh.size = Vector3(width * 1.45, 0.012, 1.15)
		stripe.position = center + Vector3(0, 0.004, i * 44.0)
		stripe.rotation.y = deg_to_rad(18.0)
		stripe.material_override = paving_material
		add_child(stripe)

func _add_roads(roads: Array) -> void:
	for road in roads:
		var points := _points_to_vectors(road.get("points", []))
		var width := float(road.get("width", DEFAULT_ROAD_WIDTH))
		if points.size() < 2:
			continue
		for i in range(points.size() - 1):
			_add_road_segment(points[i], points[i + 1], width, road)

func _add_compiled_roads(compiled_segments: Array, junctions: Array) -> void:
	for segment in compiled_segments:
		var start := _point_to_vector(segment.get("start", []))
		var end := _point_to_vector(segment.get("end", []))
		if start == end:
			continue
		var compiled_width: float = max(float(segment.get("width", DEFAULT_ROAD_WIDTH)), MIN_DRIVABLE_ROAD_WIDTH)
		var road := {
			"name": segment.get("name", "Lisbon street"),
			"type": segment.get("type", "street"),
			"width": compiled_width
		}
		_add_road_segment(start, end, road.width, road)

	for junction in junctions:
		var center := _point_to_vector(junction.get("center", []))
		var radius := float(junction.get("radius", 9.0))
		_add_junction(center, radius)

func _add_junction(center: Vector3, radius: float) -> void:
	var node := MeshInstance3D.new()
	node.name = "Junction"
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = 0.095
	mesh.radial_segments = 32
	node.mesh = mesh
	node.position = center + Vector3(0, ROAD_HEIGHT + 0.012, 0)
	node.material_override = junction_material
	add_child(node)

func _add_road_segment(start: Vector3, end: Vector3, width: float, road: Dictionary) -> void:
	var delta := end - start
	var length := delta.length()
	if length < 0.1:
		return

	var heading := atan2(delta.x, -delta.z)
	var center := (start + end) * 0.5
	var sidewalk_width := 2.4 if road.get("type", "street") != "lane" else 1.5

	_add_box("Road", center + Vector3(0, ROAD_HEIGHT, 0), Vector3(width, 0.08, length), heading, asphalt_material)
	_add_box("SidewalkL", center, Vector3(sidewalk_width, 0.06, length), heading, sidewalk_material, -width * 0.5 - sidewalk_width * 0.5 - 0.25)
	_add_box("SidewalkR", center, Vector3(sidewalk_width, 0.06, length), heading, sidewalk_material, width * 0.5 + sidewalk_width * 0.5 + 0.25)
	_add_box("CurbL", center + Vector3(0, 0.06, 0), Vector3(0.36, 0.14, length), heading, crosswalk_material, -width * 0.5 - 0.18)
	_add_box("CurbR", center + Vector3(0, 0.06, 0), Vector3(0.36, 0.14, length), heading, crosswalk_material, width * 0.5 + 0.18)

	if road.get("type", "street") != "lane":
		_add_dashed_line(start, end, heading, length)
		if length > 55.0:
			_add_crosswalk(start.lerp(end, 0.12), heading, width)
			_add_crosswalk(start.lerp(end, 0.88), heading, width)

	road_segments.append({
		"start": start,
		"end": end,
		"width": width,
		"name": road.get("name", "Lisbon street")
	})

func _add_buildings(buildings: Array) -> void:
	var index := 0
	for building in buildings:
		var points := _points_to_vectors(building.get("points", []))
		if points.size() < 3:
			continue
		var bounds := _bounds(points)
		var height: float = clamp(float(building.get("height", 12.0)) * 0.52, 3.5, 19.0)
		var footprint := Vector3(min(bounds.size.x, 36.0), height, min(bounds.size.z, 36.0))
		var material: Material = building_materials[index % building_materials.size()]
		_add_box("Building", bounds.center + Vector3(0, height * 0.5, 0), footprint, 0.0, material)
		_add_box("Roof", bounds.center + Vector3(0, height + 0.16, 0), Vector3(footprint.x * 1.03, 0.32, footprint.z * 1.03), 0.0, roof_material)
		_add_building_details(bounds.center, footprint, height, index)
		_add_collision_zone("box", bounds.center, Vector2(footprint.x * 0.5 + 2.2, footprint.z * 0.5 + 2.2))
		index += 1

func _add_greenery(green_features: Array, roads: Array, add_roadside_trees := true) -> void:
	for feature in green_features:
		var points := _points_to_vectors(feature.get("points", []))
		if points.size() < 3:
			continue
		var bounds := _bounds(points)
		_add_box("GreenPatch", bounds.center + Vector3(0, 0.01, 0), Vector3(bounds.size.x, 0.025, bounds.size.z), 0.0, _make_material(Color(0.45, 0.68, 0.31, 0.55), 0.95))

	if not add_roadside_trees:
		return

	for road in roads.slice(0, min(roads.size(), 90)):
		var points := _points_to_vectors(road.get("points", []))
		var width := float(road.get("width", DEFAULT_ROAD_WIDTH))
		if points.size() < 2:
			continue
		for i in range(points.size() - 1):
			var start := points[i]
			var end := points[i + 1]
			var length := start.distance_to(end)
			if length < 42:
				continue
			var t := 0.35
			while t < 1.0:
				var side := -1.0 if int(t * 10.0) % 2 == 0 else 1.0
				var dir := (end - start).normalized()
				var normal := Vector3(-dir.z, 0, dir.x)
				var pos := start.lerp(end, t) + normal * side * (width * 0.5 + 7.0)
				_add_tree(pos)
				t += 0.34

func _add_compiled_props(props: Array) -> void:
	for prop in props:
		var position := _point_to_vector(prop.get("position", []))
		var scale := float(prop.get("scale", 1.0))
		match prop.get("kind", "tree"):
			"tree":
				_add_tree(position, scale, prop.get("variant", "jacaranda"))
			"bush":
				_add_bush(position, scale, prop.get("variant", "olive"))
			"bench":
				_add_bench(position, float(prop.get("rotation", 0.0)), scale)
			_:
				_add_bush(position, scale, "olive")

func _add_tree(position: Vector3, scale := 1.0, variant := "jacaranda") -> void:
	_add_box("TreeTrunk", position + Vector3(0, 1.15 * scale, 0), Vector3(0.32, 2.3, 0.32) * scale, 0.0, trunk_material)
	_add_collision_zone("circle", position, Vector2(1.25 * scale, 0.0))
	var canopy := MeshInstance3D.new()
	canopy.name = "TreeCanopy"
	canopy.mesh = SphereMesh.new()
	canopy.mesh.radius = 1.7 * scale
	canopy.mesh.height = 2.35 * scale
	canopy.position = position + Vector3(0, 3.0 * scale, 0)
	canopy.material_override = leaf_materials[_variant_index(variant) % leaf_materials.size()]
	add_child(canopy)

func _add_bush(position: Vector3, scale := 1.0, variant := "olive") -> void:
	var bush := MeshInstance3D.new()
	bush.name = "Bush"
	bush.mesh = SphereMesh.new()
	bush.mesh.radius = 0.9 * scale
	bush.mesh.height = 1.0 * scale
	bush.position = position + Vector3(0, 0.55 * scale, 0)
	bush.scale = Vector3(1.25, 0.72, 1.0)
	bush.material_override = leaf_materials[(_variant_index(variant) + 1) % leaf_materials.size()]
	add_child(bush)
	_add_collision_zone("circle", position, Vector2(1.05 * scale, 0.0))

func _add_bench(position: Vector3, heading: float, scale := 1.0) -> void:
	_add_box("BenchSeat", position + Vector3(0, 0.46 * scale, 0), Vector3(2.4, 0.22, 0.55) * scale, heading, bench_material)
	_add_box("BenchBack", position + Vector3(0, 0.83 * scale, -0.26 * scale), Vector3(2.4, 0.55, 0.18) * scale, heading, bench_material)
	_add_collision_zone("circle", position, Vector2(1.35 * scale, 0.0))

func _add_toy_landmarks() -> void:
	_add_box("ToyMonument", Vector3(-75, 8, 285), Vector3(5, 16, 5), 0.0, _make_material(Color(0.9, 0.67, 0.29), 0.7))

func _add_dashed_line(start: Vector3, end: Vector3, heading: float, length: float) -> void:
	var dash_length := 5.2
	var gap := 5.8
	var cursor := 5.0
	while cursor < length - 4.0:
		var t := cursor / length
		var dash_center := start.lerp(end, t)
		_add_box("LaneDash", dash_center + Vector3(0, 0.105, 0), Vector3(0.26, 0.035, dash_length), heading, lane_material)
		cursor += dash_length + gap

func _add_crosswalk(center: Vector3, heading: float, road_width: float) -> void:
	for i in range(-3, 4):
		_add_box("CrosswalkStripe", center + Vector3(0, 0.115, 0), Vector3(0.72, 0.035, road_width * 0.82), heading + PI * 0.5, crosswalk_material, float(i) * 1.1)

func _add_building_details(center: Vector3, footprint: Vector3, height: float, index: int) -> void:
	var rows: int = max(1, int(height / 4.2))
	var cols_x: int = clamp(int(footprint.x / 5.5), 1, 5)
	var cols_z: int = clamp(int(footprint.z / 5.5), 1, 5)
	for row in range(rows):
		var y: float = 2.5 + float(row) * 3.6
		for col in range(cols_x):
			var x: float = -footprint.x * 0.38 + float(col) * (footprint.x * 0.76 / max(cols_x - 1, 1))
			_add_box("WindowFront", center + Vector3(x, y, -footprint.z * 0.505), Vector3(1.05, 1.3, 0.12), 0.0, window_material)
			_add_box("WindowBack", center + Vector3(x, y, footprint.z * 0.505), Vector3(1.05, 1.3, 0.12), 0.0, window_material)
		for col in range(cols_z):
			var z: float = -footprint.z * 0.38 + float(col) * (footprint.z * 0.76 / max(cols_z - 1, 1))
			_add_box("WindowSideL", center + Vector3(-footprint.x * 0.505, y, z), Vector3(0.12, 1.3, 1.05), 0.0, window_material)
			_add_box("WindowSideR", center + Vector3(footprint.x * 0.505, y, z), Vector3(0.12, 1.3, 1.05), 0.0, window_material)
	if index % 3 == 0:
		_add_box("Awning", center + Vector3(0, 2.1, -footprint.z * 0.58), Vector3(min(footprint.x * 0.62, 12.0), 0.3, 1.0), 0.0, awning_material)

func _compute_spawn(slice: Dictionary) -> void:
	var spawn: Dictionary = slice.get("spawn", {})
	if spawn.has("position"):
		var pose := _nearest_segment_pose(_point_to_vector(spawn.position), float(spawn.get("heading", 0.0)))
		spawn_position = pose.position + Vector3(0, 0.42, 0)
		spawn_heading = pose.heading
		return

	var target := Vector3(-230, 0.25, 285)
	var best_distance := INF
	for segment in road_segments:
		var hit := _closest_point_on_segment(target, segment.start, segment.end)
		var distance := hit.distance_to(target)
		if distance < best_distance:
			best_distance = distance
			spawn_position = hit + Vector3(0, 0.42, 0)
			var delta: Vector3 = segment.end - segment.start
			spawn_heading = atan2(delta.x, -delta.z)

func _nearest_segment_pose(point: Vector3, fallback_heading: float) -> Dictionary:
	var best_distance := INF
	var best_heading := fallback_heading
	var best_position := point
	for segment in road_segments:
		var hit := _closest_point_on_segment(point, segment.start, segment.end)
		var distance := hit.distance_to(point)
		if distance < best_distance:
			best_distance = distance
			best_position = hit
			var delta: Vector3 = segment.end - segment.start
			best_heading = atan2(delta.x, -delta.z)
	return {"position": best_position, "heading": best_heading}

func _add_box(name: String, position: Vector3, size: Vector3, heading: float, material: Material, lateral_offset := 0.0) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.name = name
	node.mesh = BoxMesh.new()
	node.mesh.size = size
	node.position = position
	node.rotation.y = heading
	node.translate_object_local(Vector3(lateral_offset, 0, 0))
	node.material_override = material
	add_child(node)
	return node

func _points_to_vectors(points: Array) -> Array[Vector3]:
	var vectors: Array[Vector3] = []
	for point in points:
		if point is Array and point.size() >= 2:
			vectors.append(_point_to_vector(point))
	return vectors

func _point_to_vector(point: Array) -> Vector3:
	if point.size() < 2:
		return Vector3.ZERO
	return Vector3(float(point[0]) * WORLD_SCALE, 0, float(point[1]) * WORLD_SCALE)

func _variant_index(value: String) -> int:
	var hash := 0
	for i in value.length():
		hash = int(hash * 31 + value.unicode_at(i)) % 997
	return abs(hash)

func _bounds(points: Array[Vector3]) -> Dictionary:
	var min_x := INF
	var max_x := -INF
	var min_z := INF
	var max_z := -INF
	for point in points:
		min_x = min(min_x, point.x)
		max_x = max(max_x, point.x)
		min_z = min(min_z, point.z)
		max_z = max(max_z, point.z)
	return {
		"center": Vector3((min_x + max_x) * 0.5, 0, (min_z + max_z) * 0.5),
		"size": Vector3(max_x - min_x, 1, max_z - min_z)
	}

func _closest_point_on_segment(point: Vector3, start: Vector3, end: Vector3) -> Vector3:
	var segment := end - start
	var length_sq: float = segment.length_squared()
	if length_sq <= 0.001:
		return start
	var t: float = clamp((point - start).dot(segment) / length_sq, 0.0, 1.0)
	return start + segment * t

func _fallback_roads() -> Array:
	return [
		{"name": "Prototype Avenue", "type": "street", "width": 12, "points": [[-240, 280], [-160, 160], [-80, 40], [20, -120]]},
		{"name": "Arcade Cross", "type": "street", "width": 10, "points": [[-240, 40], [-80, 40], [80, 55], [210, 80]]}
	]

func _clear_children() -> void:
	road_segments.clear()
	collision_zones.clear()
	for child in get_children():
		child.queue_free()

func _add_collision_zone(kind: String, center: Vector3, size: Vector2) -> void:
	collision_zones.append({
		"kind": kind,
		"center": center,
		"size": size
	})

static func _make_material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material
