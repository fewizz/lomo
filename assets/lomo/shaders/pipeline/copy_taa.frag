#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/******************************************************
  canvas:shaders/pipeline/post/copy.frag
******************************************************/
uniform sampler2DArray u_next_color_and_weight;

out vec4 out_taa_color_and_weight[4];

void main() {
	out_taa_color_and_weight[0] = texelFetch(u_next_color_and_weight, ivec3(gl_FragCoord.xy, 0), 0);
	out_taa_color_and_weight[1] = texelFetch(u_next_color_and_weight, ivec3(gl_FragCoord.xy, 1), 0);
	out_taa_color_and_weight[2] = texelFetch(u_next_color_and_weight, ivec3(gl_FragCoord.xy, 2), 0);
	out_taa_color_and_weight[3] = texelFetch(u_next_color_and_weight, ivec3(gl_FragCoord.xy, 3), 0);
}