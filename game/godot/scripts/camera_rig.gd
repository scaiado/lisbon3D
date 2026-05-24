extends Node3D

@export var target: Node3D
@export var height := 68.0
@export var trailing_distance := 5.0
@export var look_ahead := 6.0
@export var follow_speed := 6.0

var camera: Camera3D

func _ready() -> void:
	camera = Camera3D.new()
	camera.name = "ToyDriveCamera"
	camera.fov = 47.0
	camera.near = 0.05
	camera.far = 1600.0
	camera.current = true
	add_child(camera)

func _process(delta: float) -> void:
	if not target or not camera:
		return

	var forward := (-target.global_transform.basis.z).normalized()
	var desired := target.global_position - forward * trailing_distance + Vector3.UP * height
	global_position = global_position.lerp(desired, min(delta * follow_speed, 1.0))

	var look_at := target.global_position + forward * look_ahead + Vector3.UP * 0.7
	camera.global_position = global_position
	camera.look_at(look_at, Vector3.UP)
