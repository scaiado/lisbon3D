extends Node3D

const MAX_SPEED := 42.0
const BOOST_SPEED := 62.0
const ACCELERATION := 34.0
const BRAKE_FORCE := 48.0
const DRAG := 3.2
const STEER_RATE := 2.2

var speed := 0.0
var steering := 0.0
var road_segments: Array[Dictionary] = []

var body_material := _make_material(Color(0.95, 0.22, 0.14), 0.45)
var glass_material := _make_material(Color(0.05, 0.11, 0.14), 0.35)
var wheel_material := _make_material(Color(0.02, 0.02, 0.02), 0.8)

func _ready() -> void:
	_build_car_mesh()

func configure(segments: Array[Dictionary]) -> void:
	road_segments = segments

func reset_motion() -> void:
	speed = 0.0
	steering = 0.0

func _physics_process(delta: float) -> void:
	var throttle := Input.get_action_strength("accelerate")
	var brake := Input.get_action_strength("brake")
	var boost := 1.0 if not Input.is_action_pressed("boost") else BOOST_SPEED / MAX_SPEED
	var steer_input := Input.get_action_strength("steer_left") - Input.get_action_strength("steer_right")

	speed += throttle * ACCELERATION * delta
	speed -= brake * BRAKE_FORCE * delta
	speed = move_toward(speed, 0.0, DRAG * delta)
	speed = clamp(speed, -12.0, MAX_SPEED * boost)

	steering = lerp(steering, steer_input, min(delta * 8.0, 1.0))
	rotation.y -= steering * STEER_RATE * delta * clamp(abs(speed) / 18.0, 0.25, 1.0)

	var forward := Vector3(sin(rotation.y), 0, -cos(rotation.y))
	global_position += forward * speed * delta

	var nearest := _nearest_road(global_position)
	if nearest.has("point"):
		var road_width := float(nearest.segment.get("width", 9.0))
		if nearest.distance > road_width * 0.82:
			global_position = global_position.lerp(nearest.point + Vector3(0, global_position.y, 0), min(delta * 2.4, 1.0))
			speed *= 0.985

func _nearest_road(point: Vector3) -> Dictionary:
	var best := {}
	for segment in road_segments:
		var hit := _closest_point_on_segment(point, segment.start, segment.end)
		var distance := hit.distance_to(point)
		if best.is_empty() or distance < best.distance:
			best = {"point": hit, "distance": distance, "segment": segment}
	return best

func _closest_point_on_segment(point: Vector3, start: Vector3, end: Vector3) -> Vector3:
	var segment := end - start
	var length_sq := segment.length_squared()
	if length_sq <= 0.001:
		return start
	var t := clamp((point - start).dot(segment) / length_sq, 0.0, 1.0)
	return start + segment * t

func _build_car_mesh() -> void:
	_add_box("Body", Vector3(0, 0.45, 0), Vector3(1.65, 0.55, 2.85), body_material)
	_add_box("Cabin", Vector3(0, 0.95, -0.2), Vector3(1.05, 0.55, 1.05), glass_material)
	for x in [-0.9, 0.9]:
		for z in [-1.0, 1.0]:
			_add_box("Wheel", Vector3(x, 0.24, z), Vector3(0.28, 0.42, 0.42), wheel_material)

func _add_box(name: String, position: Vector3, size: Vector3, material: Material) -> void:
	var node := MeshInstance3D.new()
	node.name = name
	node.mesh = BoxMesh.new()
	node.mesh.size = size
	node.position = position
	node.material_override = material
	add_child(node)

static func _make_material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material
