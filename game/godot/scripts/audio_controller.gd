extends Node

@export var vehicle: Node

var engine_player: AudioStreamPlayer
var generator := AudioStreamGenerator.new()
var phase := 0.0

func _ready() -> void:
	generator.mix_rate = 22050
	generator.buffer_length = 0.08
	engine_player = AudioStreamPlayer.new()
	engine_player.stream = generator
	engine_player.volume_db = -24.0
	add_child(engine_player)
	engine_player.play()

func _process(_delta: float) -> void:
	if not engine_player:
		return

	var playback := engine_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if not playback:
		return

	var speed := 0.0
	if vehicle:
		speed = abs(float(vehicle.get("speed")))

	var frequency := 46.0 + speed * 2.1
	var amplitude := 0.03 + min(speed / 62.0, 1.0) * 0.055
	while playback.can_push_buffer(1):
		phase = fmod(phase + frequency / generator.mix_rate, 1.0)
		var saw := phase * 2.0 - 1.0
		var sample := saw * amplitude
		playback.push_frame(Vector2(sample, sample))
