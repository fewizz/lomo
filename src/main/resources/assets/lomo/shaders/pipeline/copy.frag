#include frex:shaders/api/header.glsl

// lomo:copy.frag

uniform sampler2D u_input;

in vec2 vs_uv;
out vec4 out_color;

void main() {
	out_color = texture(u_input, vs_uv);
}
