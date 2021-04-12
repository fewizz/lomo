#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:copy_with_depth */

uniform sampler2D u_input;
uniform sampler2D u_input_depth;

in vec2 _cvv_texcoord;
out vec4 out_color;

void main() {
	out_color = texture(u_input, _cvv_texcoord);
	gl_FragDepth = vec4(texture(u_input_depth, _cvv_texcoord)).r;
}
