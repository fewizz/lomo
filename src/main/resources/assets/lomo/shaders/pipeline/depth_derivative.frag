#include frex:shaders/api/header.glsl

/* lomo:pipeline/derivative.frag */

uniform sampler2DArray u_depths;

layout(location = 0) out vec4 out_d0;
layout(location = 1) out vec4 out_d1;
layout(location = 2) out vec4 out_d2;
layout(location = 3) out vec4 out_d3;
layout(location = 4) out vec4 out_d4;
layout(location = 5) out vec4 out_d5;

void main() {
	float depths[6] = float[](
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 0), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 1), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 2), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 3), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 4), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 5), 0).r
	);

	out_d0 = vec4(dFdx(depths[0]), dFdy(depths[0]), 0, 0);
	out_d1 = vec4(dFdx(depths[1]), dFdy(depths[1]), 0, 0);
	out_d2 = vec4(dFdx(depths[2]), dFdy(depths[2]), 0, 0);
	out_d3 = vec4(dFdx(depths[3]), dFdy(depths[3]), 0, 0);
	out_d4 = vec4(dFdx(depths[4]), dFdy(depths[4]), 0, 0);
	out_d5 = vec4(dFdx(depths[5]), dFdy(depths[5]), 0, 0);
}