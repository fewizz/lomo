#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/copy_solid.frag */

uniform sampler2D u_color;
uniform sampler2D u_normal;
uniform sampler2D u_extra;
uniform sampler2D u_depth;

layout(location = 0) out vec4 out_color;
layout(location = 1) out vec4 out_normal;
layout(location = 2) out vec4 out_extra;
layout(location = 3) out vec4 out_depth;

void main() {
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0);
	out_normal = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0);
	out_extra = texelFetch(u_extra, ivec2(gl_FragCoord.xy), 0);
	out_depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0);
}