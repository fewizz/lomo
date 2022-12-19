#include lomo:shaders/pipeline/post/sky.glsl

layout(location = 0) out vec3 face[6];

void main() {
	vec3 d = normalize(
		vec3(gl_FragCoord.xy / frxu_size.xy - 0.5, 0.5)
	);

	// sky function takes world-space view direction
	face[0] = sky(vec3( d.z, -d.y, -d.x), 1.0);
	face[1] = sky(vec3(-d.z, -d.y,  d.x), 1.0);
	face[2] = sky(vec3( d.x,  d.z,  d.y), 1.0);
	face[3] = sky(vec3(-d.x, -d.z, -d.y), 1.0);
	face[4] = sky(vec3( d.x, -d.y,  d.z), 1.0);
	face[5] = sky(vec3(-d.x, -d.y, -d.z), 1.0);
}