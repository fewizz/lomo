#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/copy_solid.frag */

uniform sampler2D u_color;
uniform sampler2D u_normal;
uniform sampler2D u_geometric_normal;
uniform sampler2D u_extra_0;
uniform sampler2D u_extra_1;
uniform sampler2D u_depth;

layout(location = 0) out vec4 out_color;
layout(location = 1) out vec3 out_normal;
layout(location = 2) out vec3 out_geometric_normal;
layout(location = 3) out vec3 out_extra_0;
layout(location = 4) out vec3 out_extra_1;
layout(location = 5) out float out_depth;

void main() {
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0);
	out_normal = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	out_geometric_normal = texelFetch(u_geometric_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	out_extra_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0).xyz;
	out_extra_1 = texelFetch(u_extra_1, ivec2(gl_FragCoord.xy), 0).xyz;
	out_depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).x;
}