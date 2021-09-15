#include frex:shaders/api/header.glsl

// lomo:copy.frag

uniform sampler2D u_input;

out vec4 out_color;

void main() {
	out_color = texelFetch(u_input, ivec2(gl_FragCoord.xy), 0);
}
