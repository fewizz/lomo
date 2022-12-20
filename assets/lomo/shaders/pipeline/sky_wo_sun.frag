#include lomo:shaders/pipeline/post/sky.glsl

layout(location = 0) out vec3 face[6];

void main() {
	// d is a direction to a positive Z
	vec3 d = normalize(
		vec3(gl_FragCoord.xy / frxu_size.xy - 0.5, 0.5)
	);
	d.y *= -1.0;

	const vec3 y_axis = vec3(0, 1, 0);
	const vec3 x_axis = vec3(1, 0, 0);

	// sky function takes world-space view direction
	face[0] = sky(rotation( PI / 2.0, y_axis) * d, 0.0);
	face[1] = sky(rotation(-PI / 2.0, y_axis) * d, 0.0);
	face[2] = sky(rotation(-PI / 2.0, x_axis) * d, 0.0);
	face[3] = sky(rotation( PI / 2.0, x_axis) * d, 0.0);
	face[4] = sky(                              d, 0.0);
	face[5] = sky(rotation( PI,       y_axis) * d, 0.0);
}