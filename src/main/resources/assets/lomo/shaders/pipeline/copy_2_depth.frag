#include frex:shaders/api/header.glsl

/* lomo:pipeline/copy_2_depth */

uniform sampler2D u_depth_0;
uniform sampler2D u_depth_1;

out vec4 o[2];

void main() {
	o[0] = texelFetch(u_depth_0, ivec2(gl_FragCoord.xy), 0);
	o[1] = texelFetch(u_depth_1, ivec2(gl_FragCoord.xy), 0);
}
