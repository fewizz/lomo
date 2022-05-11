#include frex:shaders/api/header.glsl

/* lomo:pipeline/copy.frag */

uniform sampler2DArray u_input;

layout(location = 0) out vec4 out_0;
layout(location = 1) out vec4 out_1;

void main() {
	out_0 = texelFetch(u_input, ivec3(gl_FragCoord.xy, 0), 0);
	out_1 = texelFetch(u_input, ivec3(gl_FragCoord.xy, 1), 0);
}
