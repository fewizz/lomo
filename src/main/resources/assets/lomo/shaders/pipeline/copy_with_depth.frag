#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/copy_with_depth */

uniform sampler2D u_input;
uniform sampler2D u_input_depth;

out vec4 o;

void main() {
	o = texelFetch(u_input, ivec2(gl_FragCoord.xy), 0);
	gl_FragDepth = texelFetch(u_input_depth, ivec2(gl_FragCoord.xy), 0).r;
}
