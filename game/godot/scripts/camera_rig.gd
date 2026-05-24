extends Node3D

@export var target: Node3D
@export var height := 76.0
@export var pitch_offset := 34.0
@export var follow_speed := 8.0
@export var orthographic_size := 70.0
@export var speed_zoom := 14.0

var camera: Camera3D
var fixed_yaw := 0.0

func _ready() -> void:
	if target:
		fixed_yaw = target.rotation.y

	camera = Camera3D.new()
	camera.name = "ToyDriveCamera"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = orthographic_size
	camera.near = 0.05
	camera.far = 1600.0
	camera.current = true
	add_child(camera)

func _process(delta: float) -> void:
	if not target or not camera:
		return

	var yaw_basis := Basis(Vector3.UP, fixed_yaw)
	var desired := target.global_position + yaw_basis * Vector3(0, height, pitch_offset)
	global_position = global_position.lerp(desired, min(delta * follow_speed, 1.0))

	var speed: float = abs(float(target.get("speed"))) if target else 0.0
	var target_size: float = orthographic_size + clamp(speed / 62.0, 0.0, 1.0) * speed_zoom
	camera.size = lerp(camera.size, target_size, min(delta * 3.2, 1.0))
	camera.global_position = global_position
	camera.look_at(target.global_position + Vector3.UP * 0.7, Vector3.UP)
