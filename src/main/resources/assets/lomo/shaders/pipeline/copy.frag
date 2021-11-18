#include frex:shaders/api/header.glsl

/* lomo:pipeline/copy.frag */

uniform sampler2D u_input;

layout(location = 0) out vec4 out_color;

void main() {
	out_color = texelFetch(u_input, ivec2(gl_FragCoord.xy), 0);
}
