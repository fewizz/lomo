#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

uniform sampler2D u_main;
uniform sampler2D u_depth;

float sqrt_0_5 = sqrt(0.5);

float linearalize(float val) {
	return val*val;
}

float focus(float center_depth_ws, float depth_ws) {
	center_depth_ws = linearalize(center_depth_ws);
	depth_ws = linearalize(depth_ws);

	// not sure
	if(depth_ws <= center_depth_ws)
		return sqrt((center_depth_ws - depth_ws) / center_depth_ws);
	else
		return (depth_ws - center_depth_ws) / (1 - center_depth_ws);
}

void main() {
	float center_depth_ws = texelFetch(u_depth, textureSize(u_depth, 0) / 2, 0).r;

	vec4 resulting_color = vec4(0);
	float resulting_mul = 0;

	for(int x = -1; x <= 1; ++x) {
		for(int y = -1; y <= 1; ++y) {
			ivec2 coord = ivec2(gl_FragCoord.xy) + ivec2(x, y);

			vec4 color = texelFetch(u_main, coord, 0);

			if(x == 0 && y == 0) {
				resulting_color += color;
				resulting_mul += 1;
			}
			else {
				float dist = x*y != 0 ? sqrt_0_5 : 1;
			
				float depth = texelFetch(u_depth, coord, 0).r;
				float mul = dist * focus(center_depth_ws, depth);
				resulting_color += color * mul;
				resulting_mul += mul;
			}
		}

		gl_FragData[0] = resulting_color / resulting_mul;
	}
}