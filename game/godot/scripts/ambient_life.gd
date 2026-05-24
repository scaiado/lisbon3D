extends Node3D

const NPC_COUNT := 6
const PED_COUNT := 10

var road_segments: Array[Dictionary] = []
var actors: Array[Dictionary] = []
var car_materials := [
	_make_material(Color(0.1, 0.55, 0.95), 0.48),
	_make_material(Color(0.98, 0.82, 0.18), 0.48),
	_make_material(Color(0.22, 0.8, 0.42), 0.48),
	_make_material(Color(0.93, 0.22, 0.65), 0.48)
]
var pedestrian_material := _make_material(Color(0.24, 0.18, 0.78), 0.72)
var pedestrian_alt_material := _make_material(Color(0.96, 0.45, 0.18), 0.72)
var head_material := _make_material(Color(1.0, 0.78, 0.52), 0.82)

func configure(segments: Array[Dictionary]) -> void:
	road_segments = segments
	_spawn_traffic()
	_spawn_pedestrians()

func _process(delta: float) -> void:
	for actor in actors:
		var segment: Dictionary = actor.segment
		var start: Vector3 = segment.start
		var end: Vector3 = segment.end
		var length: float = max(start.distance_to(end), 1.0)
		actor.t = fmod(float(actor.t) + float(actor.speed) * delta / length, 1.0)
		var position := start.lerp(end, float(actor.t))
		var direction := (end - start).normalized()
		if actor.side != 0.0:
			var normal := Vector3(-direction.z, 0, direction.x)
			position += normal * float(actor.side)
		actor.node.global_position = position + Vector3.UP * float(actor.height)
		actor.node.rotation.y = atan2(direction.x, -direction.z)
		if actor.kind == "pedestrian":
			actor.node.scale = Vector3.ONE * (1.0 + sin(Time.get_ticks_msec() * 0.008 + float(actor.t) * 20.0) * 0.035)

func get_collision_zones() -> Array[Dictionary]:
	var zones: Array[Dictionary] = []
	for actor in actors:
		var radius := 2.1 if actor.kind == "traffic" else 0.9
		zones.append({
			"kind": "circle",
			"center": actor.node.global_position,
			"size": Vector2(radius, 0.0)
		})
	return zones

func _spawn_traffic() -> void:
	var usable := _long_segments(42.0)
	for i in range(min(NPC_COUNT, usable.size())):
		var segment: Dictionary = usable[(i * 3) % usable.size()]
		var car := _make_toy_car(i)
		add_child(car)
		actors.append({
			"node": car,
			"segment": segment,
			"t": fmod(i * 0.137, 1.0),
			"speed": 6.0 + float(i % 4) * 1.6,
			"side": -float(segment.get("width", 12.0)) * 0.22,
			"height": 0.62,
			"kind": "traffic"
		})

func _spawn_pedestrians() -> void:
	var usable := _long_segments(28.0)
	for i in range(min(PED_COUNT, usable.size())):
		var segment: Dictionary = usable[(i * 5 + 1) % usable.size()]
		var pedestrian := _make_pedestrian()
		add_child(pedestrian)
		var side := 1.0 if i % 2 == 0 else -1.0
		actors.append({
			"node": pedestrian,
			"segment": segment,
			"t": fmod(i * 0.071, 1.0),
			"speed": 1.4 + float(i % 3) * 0.35,
			"side": side * (float(segment.get("width", 12.0)) * 0.5 + 4.5),
			"height": 0.0,
			"kind": "pedestrian"
		})

func _long_segments(min_length: float) -> Array[Dictionary]:
	var usable: Array[Dictionary] = []
	for segment in road_segments:
		var length: float = (segment.end - segment.start).length()
		if length >= min_length:
			usable.append(segment)
	return usable

func _make_toy_car(index: int) -> Node3D:
	var root := Node3D.new()
	root.name = "NpcToyCar"
	_add_box(root, "Body", Vector3(0, 0.42, 0), Vector3(2.85, 0.72, 4.6), car_materials[index % car_materials.size()])
	_add_box(root, "Hood", Vector3(0, 0.82, -1.05), Vector3(2.05, 0.2, 1.35), car_materials[index % car_materials.size()])
	_add_box(root, "Cabin", Vector3(0, 1.02, 0.52), Vector3(1.58, 0.58, 1.45), _make_material(Color(0.04, 0.08, 0.1), 0.35))
	_add_box(root, "LeftLight", Vector3(-0.64, 0.72, -2.35), Vector3(0.36, 0.12, 0.08), _make_material(Color(1.0, 0.9, 0.46), 0.2))
	_add_box(root, "RightLight", Vector3(0.64, 0.72, -2.35), Vector3(0.36, 0.12, 0.08), _make_material(Color(1.0, 0.9, 0.46), 0.2))
	for x in [-1.48, 1.48]:
		for z in [-1.45, 1.45]:
			_add_box(root, "Wheel", Vector3(x, 0.3, z), Vector3(0.36, 0.58, 0.58), _make_material(Color(0.02, 0.02, 0.02), 0.8))
	return root

func _make_pedestrian() -> Node3D:
	var root := Node3D.new()
	root.name = "ToyPedestrian"
	var shirt := pedestrian_material if actors.size() % 2 == 0 else pedestrian_alt_material
	_add_box(root, "Body", Vector3(0, 0.58, 0), Vector3(0.55, 0.92, 0.34), shirt)
	_add_box(root, "LeftLeg", Vector3(-0.14, 0.13, 0), Vector3(0.16, 0.36, 0.18), _make_material(Color(0.08, 0.12, 0.18), 0.7))
	_add_box(root, "RightLeg", Vector3(0.14, 0.13, 0), Vector3(0.16, 0.36, 0.18), _make_material(Color(0.08, 0.12, 0.18), 0.7))
	_add_box(root, "LeftArm", Vector3(-0.39, 0.68, 0), Vector3(0.14, 0.5, 0.14), head_material)
	_add_box(root, "RightArm", Vector3(0.39, 0.68, 0), Vector3(0.14, 0.5, 0.14), head_material)
	var head := MeshInstance3D.new()
	head.name = "Head"
	head.mesh = SphereMesh.new()
	head.mesh.radius = 0.28
	head.mesh.height = 0.42
	head.position = Vector3(0, 1.25, 0)
	head.material_override = head_material
	root.add_child(head)
	return root

func _add_box(parent: Node, name: String, position: Vector3, size: Vector3, material: Material) -> void:
	var node := MeshInstance3D.new()
	node.name = name
	node.mesh = BoxMesh.new()
	node.mesh.size = size
	node.position = position
	node.material_override = material
	parent.add_child(node)

static func _make_material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material
