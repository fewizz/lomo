#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/copy_with_depth */

uniform sampler2D u_input;
uniform sampler2D u_input_depth;

layout(location = 0) out vec4 out_color;

void main() {
	out_color = texelFetch(u_input, ivec2(gl_FragCoord.xy), 0);
	gl_FragDepth = texelFetch(u_input_depth, ivec2(gl_FragCoord.xy), 0).r;
}
