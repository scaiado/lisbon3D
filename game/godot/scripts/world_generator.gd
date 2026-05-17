extends Node3D

const ROAD_HEIGHT := 0.04
const DEFAULT_ROAD_WIDTH := 9.0
const WORLD_SCALE := 1.0

var road_segments: Array[Dictionary] = []
var spawn_position := Vector3.ZERO
var spawn_heading := 0.0

var asphalt_material := _make_material(Color(0.035, 0.055, 0.05), 0.9)
var sidewalk_material := _make_material(Color(0.92, 0.88, 0.72), 0.95)
var plaza_material := _make_material(Color(0.82, 0.74, 0.48), 0.98)
var roof_material := _make_material(Color(0.74, 0.28, 0.16), 0.78)
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
	_add_roads(roads)
	_add_buildings(slice.get("buildings", []))
	_add_greenery(slice.get("green", []), roads)
	_add_toy_landmarks()
	_compute_spawn(roads)

func get_spawn_position() -> Vector3:
	return spawn_position

func get_spawn_heading() -> float:
	return spawn_heading

func get_road_segments() -> Array[Dictionary]:
	return road_segments

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

func _add_roads(roads: Array) -> void:
	for road in roads:
		var points := _points_to_vectors(road.get("points", []))
		var width := float(road.get("width", DEFAULT_ROAD_WIDTH))
		if points.size() < 2:
			continue
		for i in range(points.size() - 1):
			_add_road_segment(points[i], points[i + 1], width, road)

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

	if road.get("type", "street") != "lane":
		_add_box("CenterLine", center + Vector3(0, 0.1, 0), Vector3(0.25, 0.035, length * 0.72), heading, _make_material(Color(0.83, 0.72, 0.32), 0.6))

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
		var height := clamp(float(building.get("height", 12.0)) * 0.85, 4.0, 38.0)
		var material: Material = building_materials[index % building_materials.size()]
		_add_box("Building", bounds.center + Vector3(0, height * 0.5, 0), Vector3(bounds.size.x, height, bounds.size.z), 0.0, material)
		_add_box("Roof", bounds.center + Vector3(0, height + 0.16, 0), Vector3(bounds.size.x * 1.03, 0.32, bounds.size.z * 1.03), 0.0, roof_material)
		index += 1

func _add_greenery(green_features: Array, roads: Array) -> void:
	for feature in green_features:
		var points := _points_to_vectors(feature.get("points", []))
		if points.size() < 3:
			continue
		var bounds := _bounds(points)
		_add_box("GreenPatch", bounds.center + Vector3(0, 0.01, 0), Vector3(bounds.size.x, 0.025, bounds.size.z), 0.0, _make_material(Color(0.45, 0.68, 0.31, 0.55), 0.95))

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

func _add_tree(position: Vector3) -> void:
	_add_box("TreeTrunk", position + Vector3(0, 1.2, 0), Vector3(0.35, 2.4, 0.35), 0.0, trunk_material)
	var canopy := MeshInstance3D.new()
	canopy.name = "TreeCanopy"
	canopy.mesh = SphereMesh.new()
	canopy.mesh.radius = 1.8
	canopy.mesh.height = 2.5
	canopy.position = position + Vector3(0, 3.1, 0)
	canopy.material_override = leaf_materials[randi() % leaf_materials.size()]
	add_child(canopy)

func _add_toy_landmarks() -> void:
	_add_box("ToyMonument", Vector3(-75, 8, 285), Vector3(5, 16, 5), 0.0, _make_material(Color(0.9, 0.67, 0.29), 0.7))

func _compute_spawn(roads: Array) -> void:
	var target := Vector3(-230, 0.25, 285)
	var best_distance := INF
	for segment in road_segments:
		var hit := _closest_point_on_segment(target, segment.start, segment.end)
		var distance := hit.distance_to(target)
		if distance < best_distance:
			best_distance = distance
			spawn_position = hit + Vector3(0, 0.32, 0)
			var delta: Vector3 = segment.end - segment.start
			spawn_heading = atan2(delta.x, -delta.z)

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
			vectors.append(Vector3(float(point[0]) * WORLD_SCALE, 0, float(point[1]) * WORLD_SCALE))
	return vectors

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
	var length_sq := segment.length_squared()
	if length_sq <= 0.001:
		return start
	var t := clamp((point - start).dot(segment) / length_sq, 0.0, 1.0)
	return start + segment * t

func _fallback_roads() -> Array:
	return [
		{"name": "Prototype Avenue", "type": "street", "width": 12, "points": [[-240, 280], [-160, 160], [-80, 40], [20, -120]]},
		{"name": "Arcade Cross", "type": "street", "width": 10, "points": [[-240, 40], [-80, 40], [80, 55], [210, 80]]}
	]

func _clear_children() -> void:
	for child in get_children():
		child.queue_free()

static func _make_material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material
