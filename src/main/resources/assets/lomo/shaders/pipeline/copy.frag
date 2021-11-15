#include frex:shaders/api/header.glsl

/* lomo:pipeline/copy.frag */

uniform sampler2D u_input;

out vec4 o;

void main() {
	o = texelFetch(u_input, ivec2(gl_FragCoord.xy), 0);
}
