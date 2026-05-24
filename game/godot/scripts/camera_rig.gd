extends Node3D

@export var target: Node3D
@export var height := 92.0
@export var follow_speed := 8.0
@export var orthographic_size := 62.0

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

	var desired := target.global_position + Vector3.UP * height
	global_position = global_position.lerp(desired, min(delta * follow_speed, 1.0))

	camera.global_position = global_position
	camera.rotation = Vector3(deg_to_rad(-90.0), fixed_yaw, 0.0)
