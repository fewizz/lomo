#include frex:shaders/api/header.glsl

// lomo:copy_2_depth

uniform sampler2D u_depth_0;
uniform sampler2D u_depth_1;

out vec4 out_depth_0;
out vec4 out_depth_1;

void main() {
	out_depth_0 = texelFetch(u_depth_0, ivec2(gl_FragCoord.xy), 0);
	out_depth_1 = texelFetch(u_depth_1, ivec2(gl_FragCoord.xy), 0);
}
