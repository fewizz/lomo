#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:copy_with_depth */

uniform sampler2D u_input;
uniform sampler2D u_input_depth;

in vec2 vs_uv;
out vec4 out_color;

void main() {
	out_color = texture(u_input, vs_uv);
	gl_FragDepth = vec4(texture(u_input_depth, vs_uv)).r;
}
