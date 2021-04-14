#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

uniform sampler2D u_depth;

out vec4 depth;

void main() {
	depth = vec4(
		linearalize_win_z(
			texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r,
			frx_projectionMatrix()
		),
		0.0,
		0.0,
		0.0
	);
}