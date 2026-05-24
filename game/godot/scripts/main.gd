extends Node3D

const WorldGenerator := preload("res://scripts/world_generator.gd")
const VehicleController := preload("res://scripts/vehicle_controller.gd")
const CameraRig := preload("res://scripts/camera_rig.gd")
const AudioController := preload("res://scripts/audio_controller.gd")
const AmbientLife := preload("res://scripts/ambient_life.gd")
const HudController := preload("res://scripts/hud_controller.gd")

const DATA_PATH := "res://data/lisbon_slice.json"
const SAMPLE_DATA_PATH := "res://data/lisbon_slice.sample.json"

var world: Node3D
var vehicle: Node3D
var camera_rig: Node3D
var audio_controller: Node
var ambient_life: Node3D
var hud: CanvasLayer

func _ready() -> void:
	var editor_preview := get_node_or_null("EditorPreview")
	if editor_preview:
		editor_preview.queue_free()

	var slice := _load_slice()
	world = WorldGenerator.new()
	world.name = "GeneratedLisbonWorld"
	add_child(world)
	world.generate(slice)

	vehicle = VehicleController.new()
	vehicle.name = "PlayerCar"
	vehicle.position = world.get_spawn_position()
	vehicle.rotation.y = world.get_spawn_heading()
	vehicle.configure(world.get_road_segments(), world.get_collision_zones())
	add_child(vehicle)

	camera_rig = CameraRig.new()
	camera_rig.name = "CameraRig"
	camera_rig.target = vehicle
	add_child(camera_rig)

	ambient_life = AmbientLife.new()
	ambient_life.name = "AmbientLife"
	add_child(ambient_life)
	ambient_life.configure(world.get_road_segments())

	audio_controller = AudioController.new()
	audio_controller.name = "AudioController"
	audio_controller.vehicle = vehicle
	add_child(audio_controller)

	hud = HudController.new()
	hud.name = "DriveHud"
	hud.vehicle = vehicle
	add_child(hud)

func _process(delta: float) -> void:
	if Input.is_action_just_pressed("respawn") and vehicle:
		vehicle.global_position = world.get_spawn_position()
		vehicle.rotation.y = world.get_spawn_heading()
		vehicle.reset_motion()

func _load_slice() -> Dictionary:
	var path := DATA_PATH if FileAccess.file_exists(DATA_PATH) else SAMPLE_DATA_PATH
	if not FileAccess.file_exists(path):
		push_warning("No Lisbon slice data found; using procedural fallback.")
		return {}

	var file := FileAccess.open(path, FileAccess.READ)
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("Lisbon slice JSON is invalid; using procedural fallback.")
		return {}

	return parsed
