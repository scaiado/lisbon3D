extends CanvasLayer

@export var vehicle: Node

var speed_label: Label
var status_label: Label
var title_label: Label

func _ready() -> void:
	speed_label = _make_label("0\nKM/H", Vector2(28, 26), 34, Color(1.0, 0.94, 0.82))
	status_label = _make_label("SHIFT BOOST  /  R RESPAWN", Vector2(28, 116), 18, Color(0.98, 0.82, 0.34))
	title_label = _make_label("LISBON TOY DRIVE", Vector2(28, 158), 22, Color(1.0, 0.94, 0.82))

func _process(_delta: float) -> void:
	if not vehicle:
		return

	var speed: float = abs(float(vehicle.get("speed")))
	speed_label.text = "%02d\nKM/H" % roundi(speed * 3.2)
	var boost_text: String = "FULL THROTTLE" if Input.is_action_pressed("boost") else "SHIFT BOOST"
	status_label.text = "%s  /  R RESPAWN" % boost_text

func _make_label(text: String, position: Vector2, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = position
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	label.add_theme_constant_override("shadow_offset_x", 3)
	label.add_theme_constant_override("shadow_offset_y", 3)
	add_child(label)
	return label
