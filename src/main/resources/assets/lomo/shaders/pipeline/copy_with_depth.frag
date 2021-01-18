#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:copy_with_depth */

uniform sampler2D u_input;
uniform sampler2D u_input_depth;

varying vec2 _cvv_texcoord;

void main() {
	gl_FragData[0] = texture2D(u_input, _cvv_texcoord);
    gl_FragDepth = vec4(texture2D(u_input_depth, _cvv_texcoord)).r;
}
